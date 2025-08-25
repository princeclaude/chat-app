import React from 'react'
import { FaChevronLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';



const PrivacyPolicy = () => {
    const navigate = useNavigate();

    return (
        <>
      <button onClick={() => navigate("/home")} className=''>
              <FaChevronLeft className='text-purple-500 ml-3 mt-3'/>
          </button>
      <div style={{ padding: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
          
      <h1 className='text-purple-700 font-bold text-center mb-5 text-2xl'>
        Privacy Policy for Chirp
      </h1>
      <p>
        <strong>Effective Date:</strong> 2025
      </p>

      <section>
        <p>
          At <strong>Chirp</strong>, your privacy is important to us. This
          Privacy Policy explains how we collect, use, protect, and handle your
          information when you use our chat application. By using Chirp, you
          agree to the practices described here.
        </p>
      </section>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account Information:</strong> Your email address, unique PIN,
          and profile details you provide (such as profile picture).
        </li>
        <li>
          <strong>Authentication Data:</strong> Credentials and verification
          details used to sign up, log in, or reset your account.
        </li>
        <li>
          <strong>Messages and Media:</strong> Chat messages, media, and
          documents you send or receive. These are stored temporarily and
          automatically deleted after <strong>30 days</strong>.
        </li>
        <li>
          <strong>Device Information:</strong> Technical details about your
          device, operating system, and app activity.
        </li>
        <li>
          <strong>Usage Data:</strong> Information about your interactions
          within the app, such as recent conversations and expectations.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Provide and maintain the Chirp chat service.</li>
        <li>Enable secure communication between users.</li>
        <li>Verify accounts and manage PIN-based authentication.</li>
        <li>Deliver reminders, notifications, and service updates.</li>
        <li>Improve app performance, security, and reliability.</li>
        <li>Comply with legal obligations and prevent fraud or misuse.</li>
      </ul>

      <h2>3. Data Retention</h2>
      <p>
        - Messages and media are stored only for <strong>30 days</strong> and
        then permanently deleted. <br />
        - Account details (email, PIN, profile picture) remain until you delete
        your account. <br />- Temporary data (such as session logs) may be kept
        for troubleshooting and security purposes.
      </p>

      <h2>4. Sharing of Information</h2>
      <p>
        We do{" "}
        <strong>not sell, rent, or trade your personal information</strong>.
        Your information may only be shared in the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Service Providers:</strong> To enable app features such as
          authentication, storage, and notifications.
        </li>
        <li>
          <strong>Legal Requirements:</strong> If required by law, regulation,
          or valid legal request.
        </li>
        <li>
          <strong>Security & Safety:</strong> To detect, prevent, or address
          fraud, abuse, or security threats.
        </li>
      </ul>

      <h2>5. Data Security</h2>
      <p>
        We take strong measures to protect your data, including: - Encrypted
        transmission of messages and sensitive data. - Secure storage using
        trusted cloud providers. - Regular monitoring and updates to reduce
        security risks.
      </p>
      <p>
        Despite these safeguards, no system is completely secure. We encourage
        you to protect your login credentials and use Chirp responsibly.
      </p>

      <h2>6. Your Rights</h2>
      <p>You may have the right to:</p>
      <ul>
        <li>Access, update, or correct your account information.</li>
        <li>Request deletion of your account and associated data.</li>
        <li>Opt out of certain notifications.</li>
        <li>Request a copy of the information we hold about you.</li>
      </ul>
      <p>
        You can manage most of these rights through the{" "}
        <strong>Settings</strong> page in the app or by contacting our support
        team.
      </p>

      <h2>7. Children's Privacy</h2>
      <p>
        <strong>Chirp</strong> is not intended for users under the age of{" "}
        <strong>13</strong> (or the minimum legal age in your country). We do
        not knowingly collect data from children. If such data is discovered, it
        will be deleted immediately.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Changes will be
        posted in the app or on our website. By continuing to use Chirp after
        updates, you accept the revised policy.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        If you have questions or concerns about this Privacy Policy, please
        contact us:
      </p>
      
            </div>
            </>
  );
};

export default PrivacyPolicy;

