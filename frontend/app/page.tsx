import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.brandMark} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className={styles.eyebrow}>Booking infrastructure, made clear</p>
        <h1>Make time<br />worth reserving.</h1>
        <p className={styles.description}>
          A calm, reliable place to publish resources, manage availability, and
          help customers book the moments that matter.
        </p>
        <div className={styles.actions}>
          <a className={styles.primaryAction} href="/login">
            Sign in <span aria-hidden="true">↗</span>
          </a>
          <a className={styles.secondaryAction} href="/book/demo">
            Explore public booking
          </a>
        </div>
        <div className={styles.footerNote}>
          <span className={styles.statusDot} />
          Built for organizations, ready for customers
        </div>
      </section>
    </main>
  );
}
