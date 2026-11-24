import { Link } from 'react-router-dom';
import LegalPage from './site/LegalPage.jsx';
import { SITE } from '../content/site.js';

const sections = [
  {
    id: 'who',
    title: 'Who is responsible',
    body: (
      <p>
        {SITE.company} (“we”) runs {SITE.product} and is the controller for the personal data described here.
        Questions about privacy go to <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a>.
      </p>
    ),
  },
  {
    id: 'what',
    title: 'What we collect',
    body: (
      <>
        <ul>
          <li>
            <strong>Account details</strong> — your name, email address, organisation (optional) and a securely
            hashed password. If you register yourself, also the reason you gave for needing access.
          </li>
          <li>
            <strong>Content you add</strong> — datasets and their metadata, group memberships, selections and
            simulation runs.
          </li>
          <li>
            <strong>Security records</strong> — sign-in attempts (email, time, success) and an audit log of actions
            such as uploads, sharing changes, downloads and administrative decisions.
          </li>
          <li>
            <strong>Contact messages</strong> — what you send through the contact form: name, email, organisation,
            topic and message.
          </li>
        </ul>
        <p>We do not use advertising, analytics or tracking cookies, and we do not sell personal data.</p>
      </>
    ),
  },
  {
    id: 'why',
    title: 'Why we use it, and on what legal basis',
    body: (
      <ul>
        <li>
          To provide the service you signed up for — your account, your data and the people you share it with
          (performance of a contract, GDPR art. 6(1)(b)).
        </li>
        <li>
          To keep the service secure — limiting sign-in attempts, approving accounts and keeping an audit trail
          (legitimate interest, art. 6(1)(f)).
        </li>
        <li>To answer messages you send us (legitimate interest, art. 6(1)(f)).</li>
        <li>To meet legal obligations, where they apply (art. 6(1)(c)).</li>
      </ul>
    ),
  },
  {
    id: 'sharing',
    title: 'Who can see your data',
    body: (
      <>
        <p>
          You decide who sees each dataset: only you, a group you belong to, or every signed-in user. Platform
          administrators can see all datasets and accounts in order to run the service. Your name is shown to people
          you share data or groups with.
        </p>
        <p>We use these service providers, who process data on our behalf:</p>
        <ul>
          <li>Hosting — cloud servers that store the database and uploaded files.</li>
          <li>Network and security — a content-delivery and DDoS-protection service in front of the site.</li>
          <li>Fonts — web fonts are loaded from Google Fonts, which receives your IP address.</li>
          <li>
            Maps — background map tiles are loaded from OpenFreeMap, OpenTopoMap and Esri, which receive your IP
            address and the map area you view.
          </li>
        </ul>
        <p>
          Some of these providers may process data outside the EU/EEA. Where they do, we rely on appropriate
          safeguards such as the EU Commission’s standard contractual clauses or an adequacy decision.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <p>
        We set one strictly necessary cookie, <code>fciq_refresh</code>, which keeps you signed in for up to seven
        days. It is only sent to our sign-in endpoints and cannot be read by scripts. The simulator also remembers
        your map layer order in your browser’s local storage. Neither is used for tracking, so no consent banner is
        needed.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <p>
        We keep account data and your content for as long as your account exists. When an account is deleted, its
        personal details and group memberships are removed; datasets it owned can be transferred to another user so
        shared work is not lost. Security records are kept for as long as needed to protect the service. Contact
        messages are kept while we handle your request and for a reasonable time afterwards.
      </p>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          Under the GDPR you can ask for access to your data, a copy of it, correction, deletion or restriction, and
          you can object to processing based on legitimate interest. Write to{' '}
          <a href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</a> or use the{' '}
          <Link to="/contact?topic=privacy">contact form</Link>.
        </p>
        <p>
          If you think we handle your data incorrectly, you can complain to the Swedish Authority for Privacy
          Protection (Integritetsskyddsmyndigheten, IMY), or to the data protection authority where you live.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Traffic is encrypted with HTTPS, passwords are stored as salted hashes, sessions expire, access is
        role-based, and datasets marked as restricted can never be made public. No system is perfectly secure; if we
        become aware of a breach that affects you, we will tell you and the authorities as the law requires.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: <p>We will update this page when our practices change and show the date of the latest version at the top.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy policy"
      intro={
        <p className="mk-legal-intro">
          This policy explains what personal data {SITE.product} handles, why, and the choices you have. We collect as
          little as we need to run the service.
        </p>
      }
      sections={sections}
    />
  );
}
