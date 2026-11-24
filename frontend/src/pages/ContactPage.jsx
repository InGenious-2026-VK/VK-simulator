import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SiteLayout from '../components/SiteLayout.jsx';
import PageHero from './site/PageHero.jsx';
import { sendContactMessage } from '../api/client.js';
import { SITE } from '../content/site.js';
import { IcClock, IcMail, IcPin } from './site/icons.jsx';

const TOPICS = [
  ['general', 'General question'],
  ['demo', 'Book a demo or pilot'],
  ['pricing', 'Pricing and plans'],
  ['support', 'Help with my account'],
  ['privacy', 'Privacy or data request'],
];

export default function ContactPage() {
  const [params] = useSearchParams();
  const initialTopic = TOPICS.some(([v]) => v === params.get('topic')) ? params.get('topic') : 'general';
  const [form, setForm] = useState({ name: '', email: '', organization: '', topic: initialTopic, message: '', website: '' });
  const [state, setState] = useState({ status: 'idle', error: null }); // idle | sending | sent
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: null });
    try {
      await sendContactMessage({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        organization: form.organization.trim() || null,
        message: form.message.trim(),
      });
      setState({ status: 'sent', error: null });
    } catch (err) {
      setState({
        status: 'idle',
        error:
          err.status === 422
            ? 'Please check the form: a valid email and a message of at least 10 characters are needed.'
            : err.status === 429
              ? 'Too many messages from this address. Please try again in an hour, or email us directly.'
              : `We couldn't send your message (${err.message}). Please email us at ${SITE.email}.`,
      });
    }
  };

  return (
    <SiteLayout>
      <PageHero kicker="Contact" title="Let's talk about your region's food system">
        Questions, demos, pilots or support — send us a message and we'll get back to you.
      </PageHero>

      <section className="mk-section mk-section-tight">
        <div className="mk-container mk-contact">
          <aside className="mk-contact-info">
            <div className="mk-card">
              <span className="mk-icon">
                <IcMail />
              </span>
              <div>
                <h3>Email</h3>
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </div>
            </div>
            <div className="mk-card">
              <span className="mk-icon">
                <IcPin />
              </span>
              <div>
                <h3>Based in</h3>
                <p>{SITE.city}</p>
              </div>
            </div>
            <div className="mk-card">
              <span className="mk-icon">
                <IcClock />
              </span>
              <div>
                <h3>Response time</h3>
                <p>Usually within two working days.</p>
              </div>
            </div>
          </aside>

          <div className="mk-card mk-form-card">
            {state.status === 'sent' ? (
              <div className="mk-sent" role="status">
                <h2>Thank you!</h2>
                <p>Your message has been sent. We'll reply to {form.email} as soon as we can.</p>
                <Link to="/" className="mk-btn mk-btn-outline">
                  Back to home
                </Link>
              </div>
            ) : (
              <form className="mk-form" onSubmit={submit}>
                <div className="mk-form-row">
                  <label>
                    <span>Name</span>
                    <input value={form.name} onChange={set('name')} required maxLength={200} autoComplete="name" />
                  </label>
                  <label>
                    <span>Email</span>
                    <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
                  </label>
                </div>
                <div className="mk-form-row">
                  <label>
                    <span>
                      Organisation <em>(optional)</em>
                    </span>
                    <input value={form.organization} onChange={set('organization')} maxLength={200} autoComplete="organization" />
                  </label>
                  <label>
                    <span>Topic</span>
                    <select value={form.topic} onChange={set('topic')}>
                      {TOPICS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Message</span>
                  <textarea rows={6} value={form.message} onChange={set('message')} required minLength={10} maxLength={5000} />
                </label>
                {/* honeypot — hidden from people, filled in by bots */}
                <label className="mk-hp" aria-hidden="true">
                  Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </label>
                {state.error && (
                  <p className="mk-error" role="alert">
                    {state.error}
                  </p>
                )}
                <div className="mk-form-foot">
                  <p className="mk-muted small">
                    We use your details only to answer you. See our <Link to="/privacy">privacy policy</Link>.
                  </p>
                  <button type="submit" className="mk-btn mk-btn-primary mk-btn-lg" disabled={state.status === 'sending'}>
                    {state.status === 'sending' ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
