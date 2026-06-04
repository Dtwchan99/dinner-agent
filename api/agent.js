export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { date, location, lat, lng } = req.body;
  const GMAIL_TOKEN = process.env.GMAIL_TOKEN;
  const PLACES_KEY = process.env.PLACES_KEY;
  const TG_TOKEN = process.env.TG_TOKEN;
  const TG_CHAT_ID = process.env.TG_CHAT_ID;

  if (!GMAIL_TOKEN || !PLACES_KEY) {
    return res.status(500).json({ error: 'Missing API keys in environment variables' });
  }

  try {
    // Step 1: Check Google Calendar for events 5-8pm
    const timeMin = encodeURIComponent(`${date}T17:00:00+08:00`);
    const timeMax = encodeURIComponent(`${date}T20:00:00+08:00`);
    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

    const calRes = await fetch(calUrl, {
      headers: { Authorization: `Bearer ${GMAIL_TOKEN}` }
    });
    const calData = await calRes.json();

    if (calData.error) {
      return res.status(401).json({ error: `Gmail error: ${calData.error.message}` });
    }

    const rawEvents = calData.items || [];
    const events = rawEvents.map(ev => {
      const start = ev.start?.dateTime || ev.start?.date;
      const end = ev.end?.dateTime || ev.end?.date;
      const startTime = new Date(start);
      const endTime = new Date(end);
      const openUntilTime = new Date(endTime.getTime() + 90 * 60 * 1000);
      const fmt = t => t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Taipei' });
      return {
        title: ev.summary || 'Untitled event',
        time: `${fmt(startTime)} - ${fmt(endTime)}`,
        location: ev.location || 'Location not specified',
        openUntil: fmt(openUntilTime),
        endTime: openUntilTime.toISOString()
      };
    });

    if (events.length === 0) {
      return res.status(200).json({ hasEvents: false, events: [], restaurants: [], carparks: [] });
    }

    // Step 2: Find nearby restaurants and carparks
    const searchLat = lat || 25.0143;
    const searchLng = lng || 121.4675;
    const radius = 2000;

    const [restRes, parkRes] = await Promise.all([
      fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLat},${searchLng}&radius=${radius}&type=restaurant&opennow=true&rankby=prominence&key=${PLACES_KEY}`),
      fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLat},${searchLng}&radius=${radius}&keyword=public+parking&type=parking&key=${PLACES_KEY}`)
    ]);

    const [restData, parkData] = await Promise.all([restRes.json(), parkRes.json()]);

    const toKm = (lat1, lng1, lat2, lng2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
      return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
    };

    const restaurants = (restData.results || []).slice(0, 3).map(r => ({
      name: r.name,
      address: r.vicinity,
      rating: r.rating || null,
      openUntil: r.opening_hours?.open_now ? 'Open now' : 'Check hours',
      distance: `${toKm(searchLat, searchLng, r.geometry.location.lat, r.geometry.location.lng)} km`
    }));

    const carparks = (parkData.results || []).slice(0, 2).map(p => ({
      name: p.name,
      address: p.vicinity,
      distance: `${toKm(searchLat, searchLng, p.geometry.location.lat, p.geometry.location.lng)} km`
    }));

    const result = { hasEvents: true, events, restaurants, carparks };

    // Step 3: Send Telegram notification
    if (TG_TOKEN && TG_CHAT_ID) {
      const lines = [`🍽 *Dinner suggestions for ${date}*\n`];
      events.forEach(e => lines.push(`📅 *${e.title}* (${e.time})\n📍 ${e.location}\n🕐 Find restaurants open until ${e.openUntil}\n`));
      if (restaurants.length) {
        lines.push('🍴 *Nearby restaurants:*');
        restaurants.forEach(r => lines.push(`• ${r.name}${r.rating ? ' ★'+r.rating : ''} · ${r.distance}\n  ${r.address}`));
      }
      if (carparks.length) {
        lines.push('\n🅿️ *Nearby carparks:*');
        carparks.forEach(c => lines.push(`• ${c.name} · ${c.distance}\n  ${c.address}`));
      }
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT_ID, text: lines.join('\n'), parse_mode: 'Markdown' })
      });
      result.telegramSent = true;
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
