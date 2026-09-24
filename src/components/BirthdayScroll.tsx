import { useState } from 'react'
import { startBackgroundMusic } from '../lib/audio'
import './BirthdayScroll.css'

type BirthdayScrollProps = {
  onContinue?: () => void
}

function BirthdayScroll({ onContinue }: BirthdayScrollProps) {
  const [isAccepted, setIsAccepted] = useState(false)

  async function handleContinue() {
    await startBackgroundMusic()
    setIsAccepted(true)
    onContinue?.()
  }

  if (isAccepted) {
    return (
      <main className="birthday-page birthday-page--accepted">
        <section className="birthday-thanks" aria-live="polite">
          <span className="birthday-thanks__heart" aria-hidden="true">
            ♥
          </span>
          <p className="birthday-eyebrow">A little note for you</p>
          <h1>Let the celebrating begin.</h1>
          <p className="birthday-thanks__copy">
            Today is all about you, and every lovely thing that makes you,
            you.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="birthday-page">
      <div className="birthday-glow birthday-glow--one" aria-hidden="true" />
      <div className="birthday-glow birthday-glow--two" aria-hidden="true" />

      <section className="birthday-scroll" aria-labelledby="birthday-title">
        <span className="birthday-scroll__fold" aria-hidden="true" />
        <div className="birthday-scroll__seal" aria-hidden="true">
          ♥
        </div>

        <p className="birthday-eyebrow">For my favorite person</p>
        <h1 id="birthday-title">Happy Birthday, my love</h1>
        <div className="birthday-divider" aria-hidden="true">
          <span>✦</span>
        </div>
        <p className="birthday-message">
          Another year of you is the sweetest gift. Thank you for bringing so
          much warmth, laughter, and wonder into my world.
        </p>
        <p className="birthday-message birthday-message--closing">
          I hope this next chapter holds every beautiful thing your heart is
          wishing for. I love doing life with you.
        </p>

        <button
          type="button"
          className="birthday-button"
          onClick={handleContinue}
        >
          Accept &amp; Continue
          <span aria-hidden="true">→</span>
        </button>
        <p className="birthday-signoff">with all my heart</p>
      </section>
    </main>
  )
}

export default BirthdayScroll
