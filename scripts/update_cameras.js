import pg from 'pg';

async function main() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://gov_platform:change_this_development_password@localhost:5433/gujarat_video'
  });

  try {
    const res = await pool.query('SELECT id, external_id FROM cameras ORDER BY external_id LIMIT 30');
    console.log(`Found ${res.rows.length} cameras to update.`);

    for (let i = 0; i < res.rows.length; i++) {
      const camNum = String(i + 1).padStart(2, '0');
      const rtspUrl = `rtsp://103.250.160.189:8554/stream/cam${camNum}`;
      await pool.query(
        `UPDATE cameras SET stream_reference = $1, stream_protocol = 'RTSP', status = 'ACTIVE' WHERE id = $2`,
        [rtspUrl, res.rows[i].id]
      );
      console.log(`[OK] Updated ${res.rows[i].external_id} -> ${rtspUrl}`);
    }
    console.log('Successfully updated 30 cameras to official Sentinel live RTSP streams!');
  } catch (err) {
    console.error('Error updating cameras:', err);
  } finally {
    await pool.end();
  }
}

main();
