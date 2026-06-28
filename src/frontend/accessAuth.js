export const ACCESS_AUTH_STYLES = `
    .access-auth-btn {
      width:42px;
      height:42px;
      padding:0;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      border:0;
      background:transparent;
      color:var(--text-2);
      border-radius:var(--radius-sm);
      cursor:pointer;
      transition:color .18s ease,background-color .18s ease,transform .15s ease;
    }
    .access-auth-btn:hover {
      color:var(--accent);
      background:var(--accent-soft);
    }
    .access-auth-btn:active {
      transform:scale(.94);
    }
    .access-auth-btn svg {
      width:18px;
      height:18px;
      flex:0 0 18px;
    }
    .access-icon-logout {
      display:none;
    }
    .access-auth-btn.authenticated {
      color:var(--accent);
      background:var(--accent-soft);
    }
    .access-auth-btn.authenticated .access-icon-login {
      display:none;
    }
    .access-auth-btn.authenticated .access-icon-logout {
      display:block;
    }
`;

export const ACCESS_AUTH_SCRIPT = `
    (function() {
      const ACCESS_LOGIN_PATH = '/transcription';
      const ACCESS_IDENTITY_PATH = '/cdn-cgi/access/get-identity';

      function getAccessLogoutPath() {
        return '/cdn-cgi/access/logout?returnTo=' + encodeURIComponent(window.location.origin + '/tts');
      }

      function translateAccessLabel(key) {
        if (typeof t === 'function') return t(key);
        return key === 'access.logout' ? 'Sign out' : 'Sign in with Access';
      }

      function setAccessAuthLabel(button, label, key) {
        const hiddenLabel = button.querySelector('.icon-action-label');
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.setAttribute('data-i18n-aria-label', key);
        button.setAttribute('data-i18n-title', key);
        if (hiddenLabel) {
          hiddenLabel.setAttribute('data-i18n', key);
          hiddenLabel.textContent = label;
        }
      }

      function setAccessAuthState(button, authenticated) {
        const key = authenticated ? 'access.logout' : 'access.login';
        const label = translateAccessLabel(key);
        button.classList.toggle('authenticated', authenticated);
        button.dataset.authenticated = authenticated ? 'true' : 'false';
        setAccessAuthLabel(button, label, key);
      }

      function isAccessIdentityAuthenticated(identity) {
        return Boolean(identity && (identity.email || identity.user_email || identity.identity || identity.name));
      }

      async function readAccessIdentity() {
        try {
          const response = await fetch(ACCESS_IDENTITY_PATH, { credentials: 'include' });
          if (!response.ok) return null;
          return await response.json();
        } catch (error) {
          return null;
        }
      }

      document.addEventListener('DOMContentLoaded', function() {
        const button = document.getElementById('accessAuthBtn');
        if (!button) return;
        setAccessAuthState(button, false);
        button.addEventListener('click', function() {
          if (button.dataset.authenticated === 'true') {
            window.location.assign(getAccessLogoutPath());
            return;
          }
          window.location.assign(ACCESS_LOGIN_PATH);
        });
        readAccessIdentity().then(function(identity) {
          setAccessAuthState(button, isAccessIdentityAuthenticated(identity));
        });
      });
    })();
`;
