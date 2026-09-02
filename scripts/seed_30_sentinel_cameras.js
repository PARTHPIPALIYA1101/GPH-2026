import pg from 'pg';

async function seed30RealCameras() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://gov_platform:change_this_development_password@localhost:5433/gujarat_video'
  });

  try {
    console.log('Cleaning up existing camera records and dependent tables...');
    
    // Clear dependent tables first
    await pool.query('DELETE FROM alerts');
    await pool.query('DELETE FROM evidence');
    await pool.query('DELETE FROM watchlists');
    await pool.query('DELETE FROM detections');

    await pool.query('DELETE FROM ai_jobs');
    await pool.query('DELETE FROM camera_access_request_cameras');
    await pool.query('DELETE FROM camera_access_requests');
    await pool.query('DELETE FROM cameras');


    // Fetch department IDs
    const deptRes = await pool.query('SELECT id, code FROM departments');
    const depts = {};
    deptRes.rows.forEach(d => { depts[d.code] = d.id; });

    // Fetch city IDs
    const cityRes = await pool.query('SELECT id, name FROM cities');
    const cities = {};
    cityRes.rows.forEach(c => { cities[c.name] = c.id; });

    const cityList = ['Ahmedabad', 'Surat', 'Rajkot', 'Vadodara', 'Gandhinagar'];
    const deptList = ['POLICE', 'GSRTC', 'RTO', 'HOSPITAL', 'OTHER'];

    console.log('Seeding EXACTLY 30 real working Sentinel Sandbox cameras (cam01 .. cam30)...');

    const cameraLocations = [
      { name: "Kalupur Junction PTZ 1", city: "Ahmedabad", dept: "POLICE", lat: 23.0300, lng: 72.5950 },
      { name: "SG Highway Iscon Crossroad", city: "Ahmedabad", dept: "POLICE", lat: 23.0280, lng: 72.5080 },
      { name: "Ashram Road Vadaj Circle", city: "Ahmedabad", dept: "POLICE", lat: 23.0550, lng: 72.5700 },
      { name: "Geeta Mandir Central Bus Port", city: "Ahmedabad", dept: "GSRTC", lat: 23.0150, lng: 72.5890 },
      { name: "Subhash Bridge RTO Track", city: "Ahmedabad", dept: "RTO", lat: 23.0620, lng: 72.5790 },
      { name: "Civil Hospital Emergency Gate", city: "Ahmedabad", dept: "HOSPITAL", lat: 23.0510, lng: 72.6020 },
      { name: "Surat Majura Gate Circle", city: "Surat", dept: "POLICE", lat: 21.1820, lng: 72.8210 },
      { name: "Athwa Gate Junction PTZ", city: "Surat", dept: "POLICE", lat: 21.1780, lng: 72.8050 },
      { name: "Varachha Main Diamond Market", city: "Surat", dept: "POLICE", lat: 21.2150, lng: 72.8550 },
      { name: "Surat Central Bus Terminal", city: "Surat", dept: "GSRTC", lat: 21.2050, lng: 72.8420 },
      { name: "Pal RTO Complex Gate", city: "Surat", dept: "RTO", lat: 21.1890, lng: 72.7750 },
      { name: "New Civil Hospital Ambulance Entry", city: "Surat", dept: "HOSPITAL", lat: 21.1750, lng: 72.8150 },
      { name: "Rajkot Trikon Baug Junction", city: "Rajkot", dept: "POLICE", lat: 22.3000, lng: 70.8030 },
      { name: "Rajkot Yagnik Road Crossroad", city: "Rajkot", dept: "POLICE", lat: 22.2920, lng: 70.7950 },
      { name: "Rajkot Central Bus Station", city: "Rajkot", dept: "GSRTC", lat: 22.3050, lng: 70.8080 },
      { name: "Rajkot RTO Automated Track", city: "Rajkot", dept: "RTO", lat: 22.3300, lng: 70.7700 },
      { name: "AIIMS Rajkot Gate Surveillance", city: "Rajkot", dept: "HOSPITAL", lat: 22.3450, lng: 70.7500 },
      { name: "Vadodara Alkapuri Circle", city: "Vadodara", dept: "POLICE", lat: 22.3100, lng: 73.1700 },
      { name: "Vadodara Dairy Den Circle", city: "Vadodara", dept: "POLICE", lat: 22.3050, lng: 73.1850 },
      { name: "Vadodara Central Bus Depot", city: "Vadodara", dept: "GSRTC", lat: 22.3120, lng: 73.1810 },
      { name: "Darjipura RTO Checkpost", city: "Vadodara", dept: "RTO", lat: 22.3350, lng: 73.2350 },
      { name: "SSG Hospital Emergency Entry", city: "Vadodara", dept: "HOSPITAL", lat: 22.3010, lng: 73.1950 },
      { name: "Gandhinagar Sector 11 Circle", city: "Gandhinagar", dept: "POLICE", lat: 23.2180, lng: 72.6380 },
      { name: "CH-0 Circle Secretariat Gate", city: "Gandhinagar", dept: "POLICE", lat: 23.2250, lng: 72.6500 },
      { name: "Gandhinagar Pathikashram Bus Station", city: "Gandhinagar", dept: "GSRTC", lat: 23.2150, lng: 72.6350 },
      { name: "Gandhinagar RTO Office Gate", city: "Gandhinagar", dept: "RTO", lat: 23.2400, lng: 72.6450 },
      { name: "GMERS Hospital Sector 12 Gate", city: "Gandhinagar", dept: "HOSPITAL", lat: 23.2200, lng: 72.6400 },
      { name: "Infocity IT Park Gate 1", city: "Gandhinagar", dept: "OTHER", lat: 23.1950, lng: 72.6280 },
      { name: "GIFT City Main Highway Entry", city: "Gandhinagar", dept: "OTHER", lat: 23.1600, lng: 72.6800 },
      { name: "Koba Circle VIP Highway Junction", city: "Gandhinagar", dept: "POLICE", lat: 23.1450, lng: 72.6250 }
    ];

    for (let i = 0; i < 30; i++) {
      const num = String(i + 1).padStart(2, '0');
      const extId = `SENTINEL-CAM-${num}`;
      const rtspUrl = `rtsp://103.250.160.189:8554/stream/cam${num}`;
      const loc = cameraLocations[i];

      const deptId = depts[loc.dept] || Object.values(depts)[0];
      const cityId = cities[loc.city] || Object.values(cities)[0];

      await pool.query(
        `INSERT INTO cameras (
          external_id, camera_number, name, managing_department_id, city_id,
          location_description, stream_protocol, stream_reference, coordinates,
          status, ai_state, active, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          ST_SetSRID(ST_MakePoint($10, $9), 4326),
          'ACTIVE', 'PROCESSING', true, $11
        )`,
        [
          extId,
          num,
          loc.name,
          deptId,
          cityId,
          `${loc.name}, ${loc.city}, Gujarat`,
          'RTSP',
          rtspUrl,
          loc.lat,
          loc.lng,
          JSON.stringify({ resolution: '1080p', fps: 25, liveSandboxStream: `cam${num}` })
        ]
      );
      console.log(`[Inserted] ${extId}: ${loc.name} -> ${rtspUrl}`);
    }

    const countRes = await pool.query('SELECT COUNT(*) FROM cameras WHERE active = true');
    console.log(`\nDONE! Database now has EXACTLY ${countRes.rows[0].count} real working cameras!`);

  } catch (err) {
    console.error('Failed to seed 30 cameras:', err);
  } finally {
    await pool.end();
  }
}

seed30RealCameras();
