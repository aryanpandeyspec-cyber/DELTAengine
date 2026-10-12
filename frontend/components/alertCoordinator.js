/**
 * DELTA ENGINE — UNIFIED ALERT & VOICE COORDINATION ENGINE
 * 
 * Enforces:
 * 1. Single Active Alert Policy: At any time, exactly ONE alert is displayed and announced.
 * 2. Sequential FIFO Alert Queue: Incoming bursts of alerts (capacity breaches, voice announcements,
 *    volunteer dispatches, schedule alerts) are neatly queued instead of popping up simultaneously.
 * 3. Instant Voice Muting on Dismiss: Clicking dismiss immediately stops all audio playback and
 *    speech synthesis (zero lingering voices).
 * 4. Paced 2-Second Gap: Enforces a strict 2000ms delay between consecutive alerts.
 * 5. Complete UI Teardown: Dismissing an alert hides all banner elements and clears auto-dismiss timers,
 *    preventing dismissed messages from remaining on screen.
 */

(function () {
  'use strict';

  class DeltaAlertManager {
    constructor() {
      this.queue = [];
      this.currentAlert = null;
      this.isBusy = false;
      this.gapTimer = null;
      this.autoDismissTimer = null;
      this.activeAudio = null;
      this.recentlyDismissed = new Map(); // key -> timestamp
      this.dismissedStateTypes = new Set();
    }

    /**
     * Enqueue a generalized alert item
     * @param {Object} item - { type: 'volunteer'|'pa'|'push', data, alert, message, text, key }
     */
    enqueue(item) {
      if (!item) return;

      const key = item.key || item.text || (item.alert && item.alert.message) || (item.data && item.data.text) || (item.message) || String(Date.now());
      const now = Date.now();

      // Suppress duplicate if dismissed within last 10 seconds
      const dismissedAt = this.recentlyDismissed.get(key);
      if (dismissedAt && (now - dismissedAt < 10000)) {
        console.log('[DeltaAlertManager] Suppressed recently dismissed alert:', key);
        return;
      }

      // Suppress if already active or queued with same key
      if (this.currentAlert && this.currentAlert.key === key) {
        return;
      }
      if (this.queue.some(q => q.key === key)) {
        return;
      }

      item.key = key;
      this.queue.push(item);
      console.log(`[DeltaAlertManager] Alert queued (${item.type}). Queue length: ${this.queue.length}`);

      // If not currently presenting an alert and not in 2-second cooldown gap, process immediately
      if (!this.isBusy && !this.gapTimer) {
        this.processNext();
      }
    }

    enqueueVolunteerAlert(alert) {
      if (!alert) return;
      this.enqueue({
        type: 'volunteer',
        alert: alert,
        text: alert.message,
        key: `vol_${alert.type}_${alert.message}`
      });
    }

    enqueuePAAnnouncement(data) {
      if (!data) return;
      this.enqueue({
        type: 'pa',
        data: data,
        text: data.text,
        key: `pa_${(data.text || '').slice(0, 48)}`
      });
    }

    enqueuePushAlert(message, title) {
      if (!message) return;
      this.enqueue({
        type: 'push',
        message: message,
        title: title || 'Schedule Alert',
        text: message,
        key: `push_${message.slice(0, 48)}`
      });
    }

    /**
     * Process next alert from FIFO queue
     */
    processNext() {
      if (this.gapTimer) {
        return; // Currently in 2-second gap
      }

      if (this.queue.length === 0) {
        this.isBusy = false;
        this.currentAlert = null;
        return;
      }

      this.isBusy = true;
      const nextAlert = this.queue.shift();
      this.currentAlert = nextAlert;

      this.displayAndAnnounce(nextAlert);
    }

    /**
     * Display visual banner and trigger voice announcement for current alert
     */
    displayAndAnnounce(item) {
      // Clear any remaining audio first
      this.stopAllAudio();

      if (item.type === 'volunteer') {
        this.displayVolunteerAlert(item);
      } else if (item.type === 'pa') {
        this.displayPAAlert(item);
      } else if (item.type === 'push') {
        this.displayPushAlert(item);
      } else {
        this.onAlertCompleted();
      }
    }

    /**
     * Display Volunteer / Capacity Breach Alert
     */
    displayVolunteerAlert(item) {
      const alert = item.alert;
      const banner = document.getElementById('volunteer-alert-banner');
      const iconEl = banner ? banner.querySelector('.volunteer-alert-icon') : null;
      const titleEl = document.getElementById('volunteer-alert-title');
      const msgEl = document.getElementById('volunteer-alert-message');
      const tagEl = document.getElementById('volunteer-alert-recipients');

      let bannerClass = 'info-notice';
      let titleText = `ℹ️ HALL CLEARED (${alert.emptyPercent || 0}% EMPTY) — STAGE CREW SETUP AUTHORIZED`;
      let iconSymbol = 'ℹ️';

      if (alert.type === 'ROOM_FULL' || alert.type === 'CAPACITY_BREACH') {
        bannerClass = 'critical-siren';
        titleText = `🚨 CAPACITY BREACH (${alert.occupiedPercent || 100}% FULL) — VOLUNTEER REDIRECT DISPATCH`;
        iconSymbol = '🚨';
      } else if (alert.type === 'ROOM_80_PERCENT') {
        bannerClass = 'warning-amber';
        titleText = `⚠️ CAPACITY WARNING: ${(alert.hallName || 'TURING HALL').toUpperCase()} IS 80% FULL (${alert.occupiedPercent || 80}%)`;
        iconSymbol = '⚠️';
      }

      if (banner && msgEl) {
        banner.classList.remove('hidden');
        banner.style.display = 'block';
        banner.className = `volunteer-alert-banner ${bannerClass}`;
        if (iconEl) iconEl.textContent = iconSymbol;
        if (titleEl) titleEl.textContent = titleText;
        msgEl.textContent = alert.message;

        if (tagEl && alert.assignedVolunteers) {
          const targetedNote = alert.excludedCount !== undefined
            ? `<div style="font-size:0.73rem; color:#1e3a8a; font-weight:800; margin-bottom:6px;">🎯 TARGETED DISPATCH (${(alert.hallName || 'VENUE').toUpperCase()} ONLY) — ${alert.excludedCount} volunteers at other venues shielded from notification spam</div>`
            : '';
          tagEl.innerHTML = targetedNote + alert.assignedVolunteers.map(v =>
            `<span class="badge-volunteer-chip">👤 ${v.name} (${v.role}): <strong>${v.task}</strong></span>`
          ).join(' ');
        }
      }

      if (typeof window.updateVolunteerDutyCards === 'function') {
        try { window.updateVolunteerDutyCards(alert); } catch (e) {}
      }

      if (typeof window.createToast === 'function') {
        const toastType = alert.type === 'ROOM_FULL' ? 'conflict' : alert.type === 'ROOM_80_PERCENT' ? 'warning' : 'info';
        window.createToast(alert.message, toastType);
      }

      // Voice Announce
      const isSoundEnabled = localStorage.getItem('delta_sfx_enabled') !== 'false';
      if (!isSoundEnabled) {
        this.autoDismissTimer = setTimeout(() => {
          this.onAlertCompleted();
        }, 8000);
        return;
      }

      if (typeof window.playCctvAlertTone === 'function') {
        try { window.playCctvAlertTone(alert.type); } catch (e) {}
      }

      const speechNotice = `${titleText.replace(/[^\w\s%]/gi, '')}. ${alert.message}`;
      this.speakText(speechNotice, () => {
        // After voice ends, allow 2s reading buffer before auto-completion
        this.autoDismissTimer = setTimeout(() => {
          this.onAlertCompleted();
        }, 2000);
      });
    }

    /**
     * Display PA Voice Announcement
     */
    displayPAAlert(item) {
      const data = item.data;
      const paBanner = document.getElementById('venue-pa-live-banner');
      if (paBanner) {
        paBanner.style.display = 'flex';
        const textEl = document.getElementById('venue-pa-live-text');
        if (textEl) textEl.textContent = `"${data.text}"`;
        const timeEl = document.getElementById('venue-pa-live-time');
        if (timeEl) timeEl.textContent = data.timestamp || new Date().toLocaleTimeString();
        const voiceEl = document.getElementById('venue-pa-live-voice');
        if (voiceEl) voiceEl.textContent = data.voice || 'Nico Robin (Calm & Elegant)';
      }

      if (typeof window.createToast === 'function') {
        window.createToast(`📢 [Nico Robin PA Broadcaster] ${data.text}`, 'success');
      }

      const isSoundEnabled = localStorage.getItem('delta_sfx_enabled') !== 'false';
      if (!isSoundEnabled) {
        this.autoDismissTimer = setTimeout(() => {
          this.onAlertCompleted();
        }, 8000);
        return;
      }

      if (data.audioUrl) {
        this.playAudioFile(data.audioUrl, data.text, () => {
          this.autoDismissTimer = setTimeout(() => {
            this.onAlertCompleted();
          }, 1500);
        });
      } else {
        this.speakText(data.text, () => {
          this.autoDismissTimer = setTimeout(() => {
            this.onAlertCompleted();
          }, 1500);
        });
      }
    }

    /**
     * Display Push Notification Overlay
     */
    displayPushAlert(item) {
      const pushOverlay = document.getElementById('push-alert');
      const pushMsg = document.getElementById('push-message');
      if (pushOverlay && pushMsg) {
        pushMsg.textContent = item.message;
        pushOverlay.style.display = 'flex';
      }

      const isSoundEnabled = localStorage.getItem('delta_sfx_enabled') !== 'false';
      if (!isSoundEnabled) {
        this.autoDismissTimer = setTimeout(() => {
          this.onAlertCompleted();
        }, 6000);
        return;
      }

      this.speakText(item.message, () => {
        this.autoDismissTimer = setTimeout(() => {
          this.onAlertCompleted();
        }, 1500);
      });
    }

    /**
     * Speak text using available Nico Robin Speech Synthesis or window fallback
     */
    speakText(text, onComplete) {
      if (!text || localStorage.getItem('delta_sfx_enabled') === 'false') {
        if (typeof onComplete === 'function') onComplete();
        return;
      }

      if (typeof window.speakWithNicoRobinVoice === 'function') {
        window.speakWithNicoRobinVoice(text, onComplete);
        return;
      }

      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.pitch = 1.08;
          utter.rate = 0.92;
          utter.volume = 1.0;
          utter.onend = () => { if (typeof onComplete === 'function') onComplete(); };
          utter.onerror = () => { if (typeof onComplete === 'function') onComplete(); };
          window.speechSynthesis.speak(utter);
        } catch (e) {
          if (typeof onComplete === 'function') onComplete();
        }
      } else {
        if (typeof onComplete === 'function') onComplete();
      }
    }

    /**
     * Play MP3 audio file with Nico Robin speech fallback
     */
    playAudioFile(url, fallbackText, onComplete) {
      try {
        const audio = new Audio('/' + url.replace(/^\//, ''));
        this.activeAudio = audio;
        audio.onended = () => {
          this.activeAudio = null;
          if (typeof onComplete === 'function') onComplete();
        };
        audio.onerror = () => {
          this.activeAudio = null;
          this.speakText(fallbackText, onComplete);
        };
        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => {
            this.activeAudio = null;
            this.speakText(fallbackText, onComplete);
          });
        }
      } catch (e) {
        this.activeAudio = null;
        this.speakText(fallbackText, onComplete);
      }
    }

    /**
     * Instantly stop all playing audio and speech synthesis
     */
    stopAllAudio() {
      if (this.activeAudio) {
        try {
          this.activeAudio.pause();
          this.activeAudio.currentTime = 0;
        } catch (e) {}
        this.activeAudio = null;
      }

      if (typeof window.stopAllVoices === 'function') {
        try { window.stopAllVoices(); } catch (e) {}
      }

      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }
    }

    /**
     * Hide all alert banners completely from DOM
     */
    hideAllBanners() {
      const volBanner = document.getElementById('volunteer-alert-banner');
      if (volBanner) {
        volBanner.classList.add('hidden');
        volBanner.style.display = 'none';
      }

      const paBanner = document.getElementById('venue-pa-live-banner');
      if (paBanner) {
        paBanner.style.display = 'none';
      }

      const pushAlert = document.getElementById('push-alert');
      if (pushAlert) {
        pushAlert.style.display = 'none';
      }
    }

    /**
     * User clicked Dismiss or Close
     * 1. Stops audio immediately.
     * 2. Hides all banners immediately.
     * 3. Enforces 2-second gap before announcing next alert.
     */
    dismissCurrent() {
      console.log('[DeltaAlertManager] User dismissed alert. Stopping audio immediately.');

      // 1. Immediately stop all voice and audio playback
      this.stopAllAudio();

      // 2. Hide all visual alert banners
      this.hideAllBanners();

      // 3. Clear any auto-dismiss timer
      if (this.autoDismissTimer) {
        clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = null;
      }

      // 4. Record key in recentlyDismissed to avoid instant re-trigger
      if (this.currentAlert && this.currentAlert.key) {
        this.recentlyDismissed.set(this.currentAlert.key, Date.now());
      }
      if (this.currentAlert && this.currentAlert.alert && this.currentAlert.alert.type) {
        this.dismissedStateTypes.add(this.currentAlert.alert.type);
      }

      this.currentAlert = null;

      // 5. Enforce strict 2-second gap before announcing next alert
      if (this.gapTimer) clearTimeout(this.gapTimer);
      console.log('[DeltaAlertManager] Waiting 2 seconds before next alert announcement...');
      this.gapTimer = setTimeout(() => {
        this.gapTimer = null;
        this.isBusy = false;
        this.processNext();
      }, 2000);
    }

    /**
     * Alert completed naturally on its own
     */
    onAlertCompleted() {
      if (!this.isBusy || this.gapTimer) return;

      this.stopAllAudio();
      this.hideAllBanners();

      if (this.autoDismissTimer) {
        clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = null;
      }

      this.currentAlert = null;

      // Enforce strict 2-second gap before announcing next alert
      if (this.gapTimer) clearTimeout(this.gapTimer);
      this.gapTimer = setTimeout(() => {
        this.gapTimer = null;
        this.isBusy = false;
        this.processNext();
      }, 2000);
    }
  }

  // Initialize Singleton Alert Manager on window
  window.DeltaAlertManager = new DeltaAlertManager();

  // Attach global click listener for all dismiss buttons
  function setupDismissInterceptors() {
    document.addEventListener('click', function (e) {
      const target = e.target;
      if (!target) return;

      if (
        target.id === 'btn-dismiss-volunteer-banner' ||
        target.id === 'btn-close-alert-banner' ||
        target.id === 'btn-dismiss-pa-banner' ||
        (target.closest && target.closest('#push-alert') && target.tagName === 'BUTTON') ||
        (target.closest && target.closest('#btn-dismiss-volunteer-banner')) ||
        (target.closest && target.closest('#btn-close-alert-banner')) ||
        (target.closest && target.closest('#btn-dismiss-pa-banner'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        window.DeltaAlertManager.dismissCurrent();
      }
    }, true); // Capture phase to guarantee immediate interception
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDismissInterceptors);
  } else {
    setupDismissInterceptors();
  }

})();
