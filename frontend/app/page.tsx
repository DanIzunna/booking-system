import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Project foundation</p>
        <h1>Booking System</h1>
        <p className={styles.description}>
          This is the Phase 0 foundation shell for the full-stack application.
          Backend health checks, API versioning, and the web app shell are ready
          for later domain implementation.
        </p>
      </section>
    </main>
  );
}
