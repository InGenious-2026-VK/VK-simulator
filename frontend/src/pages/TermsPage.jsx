import { Link } from 'react-router-dom';
import LegalPage from './site/LegalPage.jsx';
import { SITE } from '../content/site.js';

const sections = [
  {
    id: 'agreement',
    title: 'Agreement',
    body: (
      <p>
        These terms apply when you use {SITE.product} (the “service”), provided by {SITE.company} (“we”). By
        creating an account or using the service you accept them. If you use the service on behalf of an
        organisation, you confirm that you may accept these terms for it. A separate written agreement with your
        organisation takes precedence over these terms where they differ.
      </p>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    body: (
      <ul>
        <li>New accounts may need approval by an administrator before they can be used.</li>
        <li>Give accurate details, keep your password secret, and tell us if you suspect misuse of your account.</li>
        <li>You are responsible for what happens under your account.</li>
        <li>We may suspend or close accounts that break these terms or put the service or other users at risk.</li>
      </ul>
    ),
  },
  {
    id: 'your-data',
    title: 'Your data',
    body: (
      <>
        <p>
          You keep all rights to the datasets you upload. You give us the permission we need to store, process and
          display them to the people you choose to share them with, and to run simulations on them.
        </p>
        <p>
          Only upload data you have the right to share. Each dataset’s licence and sensitivity, set in its metadata,
          tells others how they may use it — respect the licence of data shared with you. Do not upload data that is
          classified or otherwise must not be shared, and make sure any personal data is handled lawfully.
        </p>
        <p>
          You can ask for one of your datasets to be removed at any time; an administrator handles each removal
          request.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <p>
        Do not try to access data or accounts you have not been given access to, disrupt or overload the service,
        probe it for vulnerabilities without our written permission, upload malware, or use the service for anything
        unlawful.
      </p>
    ),
  },
  {
    id: 'results',
    title: 'Simulation results',
    body: (
      <p>
        Simulations are models. Their results depend on the data and assumptions used and are meant to support — not
        replace — professional judgement. Demonstration and baseline data in the service may be synthetic. Check
        results before relying on them for decisions.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        We work to keep the service available and secure, but we do not guarantee that it will be uninterrupted or
        error-free. We may change, add or remove features, and will give reasonable notice of changes that
        significantly affect you.
      </p>
    ),
  },
  {
    id: 'fees',
    title: 'Fees',
    body: (
      <p>
        The Explorer plan is free. Paid plans are set out in an offer or agreement with your organisation; see{' '}
        <Link to="/pricing">pricing</Link>.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss, lost data or lost profit
        arising from use of the service, or for decisions made on the basis of simulation results. Nothing in these
        terms limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Ending your use',
    body: (
      <p>
        You can stop using the service and ask us to delete your account at any time. When an account is deleted,
        datasets it owned may be transferred to another user in your organisation so that shared work is not lost.
        See the <Link to="/privacy">privacy policy</Link> for what happens to your personal data.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of {SITE.governingLaw}. Disputes are settled by the courts of{' '}
        {SITE.governingLaw} unless mandatory law says otherwise.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these terms: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of service"
      intro={
        <p className="mk-legal-intro">
          Please read these terms carefully. They describe what you can expect from us and what we expect from you.
        </p>
      }
      sections={sections}
    />
  );
}
