import React from 'react';
import { FaChevronLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function About() {
    const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate(-1)} className="mb-4 ml-3 mt-3">
        <FaChevronLeft className="text-purple-600" />
      </button>

      <p className="text-purple-700 text-2xl text-center mt-3 font-bold mb-3">
        ABOUT US
      </p>
      <div>
        <div class="about-container">
          
          <p>
            Chirp is a{" "}
            <strong>lightweight, privacy-first instant messaging app</strong>
            designed to make connecting with people simple, safe, and
            stress-free. Instead of relying on usernames, emails, or phone
            numbers, Chirp uses a <strong>unique PIN system</strong>
            that makes meeting new people and starting conversations easier than
            ever.
          </p>

          <p>
            With Chirp, you don't need to worry about choosing the “perfect”
            username, handling duplicates, or exposing personal details. Every
            user is given a <strong> unique 5-character PIN </strong> that's easy
            to remember, quick to share, and completely one-of-a-kind. This PIN
            becomes your digital handshake—fast, secure, and private.
          </p>

          <h3>Why PIN-Based?</h3>
          <p>
            <strong>No Username Hassle</strong>  No need to fight over taken
            usernames. Your PIN is always unique.
          </p>
          <p>
            <strong>Privacy First</strong>  Your PIN doesn't reveal anything
            personal, unlike phone numbers or emails.
          </p>
          <p>
            <strong>Easy Connections</strong>  Met someone new? Just exchange
            PINs and start chatting instantly.
          </p>
          <p>
            <strong>Accurate Search</strong> Find friends directly by their
            PIN, no typos or mix-ups.
          </p>
          <p>
            <strong>Flexible Use</strong>  Use your PIN for quick chats or
            long-term connections—you decide.
          </p>

          <h3 className='text-center font-semibold text-purple-500'>Our Vision</h3>
          <p>
            Chirp is about{" "}
            <strong>bringing back the simplicity of conversations</strong>
            —without the clutter, noise, or risks of traditional social
            platforms. By keeping things lightweight, simple, and PIN-based,
            we're creating a space where people can connect freely—whether for a
            moment or for a lifetime. 
          </p>
        </div>
      </div>
    </>
  );
}
