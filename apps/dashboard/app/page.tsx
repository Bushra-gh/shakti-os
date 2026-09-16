import { type Event } from "@shaktios/types";
import styles from "./page.module.css";

const previewEvent: Event = {
  id: "evt_preview_001",
  type: "crowd_density",
  source: "crowd_simulator",
  timestamp: "2026-09-16T09:42:00Z",
  location: "gate_4",
  confidence: 0.95,
  payload: { density: 0.42 },
};

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.eyebrow}>Operational preview / 01</div>
        <h1>SHAKTIOS</h1>
        <p className={styles.subtitle}>Event-Driven Intelligence &amp; Response Platform</p>
        <div className={styles.rule} />
        <div className={styles.contentGrid}>
          <div>
            <p className={styles.kicker}>The signal layer is taking shape.</p>
            <p className={styles.description}>
              A focused workspace for turning real-world signals into clear, accountable response.
              The command center arrives incrementally.
            </p>
          </div>
          <div className={styles.eventPanel}>
            <div className={styles.panelHeader}>
              <span>Latest signal</span>
              <span className={styles.status}>STAGED</span>
            </div>
            <pre>{JSON.stringify(previewEvent, null, 2)}</pre>
          </div>
        </div>
      </section>
    </main>
  );
}
