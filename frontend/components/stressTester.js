// --- CAPACITY LOAD STRESS SIMULATOR & SENTIMENT DISPATCHERS ---

// 1. Capacity Load Stress Simulator
function initStressSlider() {
  const slider = document.getElementById('stress-slider');
  const label = document.getElementById('stress-factor-label');

  if (!slider || !label) return;

  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    label.textContent = `${val.toFixed(1)}x (${val > 1.8 ? 'CRITICAL' : val > 1.2 ? 'WARNING' : 'Normal'})`;
    
    applyHeatmaps(val);
  });
}

function applyHeatmaps(stressFactor) {
  if (!graphState || !scheduleState) return;

  const cells = document.querySelectorAll('#schedule-tbody td[data-slot-id]');
  cells.forEach(cell => {
    const slotId = cell.getAttribute('data-slot-id');
    const hallId = cell.getAttribute('data-hall-id');
    const topicId = scheduleState[slotId][hallId];

    cell.classList.remove('heatmap-normal', 'heatmap-low', 'heatmap-warning', 'heatmap-critical', 'cell-conflict');

    if (topicId) {
      const topic = graphState.topics[topicId];
      const hall = graphState.halls[hallId];
      const simulatedInterest = Math.round(topic.interest * stressFactor);

      const fillRatio = simulatedInterest / hall.capacity;
      
      if (fillRatio >= 1.0) {
        cell.classList.add('heatmap-critical');
      } else if (fillRatio >= 0.75) {
        cell.classList.add('heatmap-warning');
      } else if (fillRatio >= 0.40) {
        cell.classList.add('heatmap-low');
      } else {
        cell.classList.add('heatmap-normal');
      }
      
      const badge = cell.querySelector('.interest-badge');
      if (badge) {
        badge.textContent = `🔥 ${simulatedInterest}`;
        if (fillRatio >= 1.0) {
          badge.style.backgroundColor = 'var(--google-red-light)';
          badge.style.color = 'var(--google-red)';
        } else {
          badge.style.backgroundColor = 'var(--google-blue-soft)';
          badge.style.color = 'inherit';
        }
      }
    }
  });
}

// 2. iCal Modal Subscription dialogs
function initICalModal() {
  const modal = document.getElementById('ical-modal');
  const btnOpen = document.getElementById('btn-open-ical');
  const btnClose = document.getElementById('btn-close-ical');
  const btnCopy = document.getElementById('btn-copy-ical');
  const inputUrl = document.getElementById('ical-feed-url');

  if (!modal || !btnOpen || !btnClose || !btnCopy || !inputUrl) return;

  btnOpen.onclick = () => {
    const protocol = window.location.protocol === 'https:' ? 'webcals:' : 'webcal:';
    inputUrl.value = `${protocol}//${window.location.host}/api/calendar/feed.ics`;
    modal.style.display = 'flex';
  };

  btnClose.onclick = () => {
    modal.style.display = 'none';
  };

  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };

  btnCopy.onclick = () => {
    inputUrl.select();
    navigator.clipboard.writeText(inputUrl.value);
    createToast('iCal subscription feed link copied!', 'success');
  };
}

// 3. Simulated Sentiment dispatches
function initSentimentSimulator() {
  const btnSentiment = document.getElementById('btn-trigger-sentiment');
  const selectSentiment = document.getElementById('select-sentiment');

  if (!btnSentiment || !selectSentiment) return;

  btnSentiment.onclick = () => {
    const val = selectSentiment.value;
    const desc = selectSentiment.options[selectSentiment.selectedIndex].text;
    
    appendLog(`[SYSTEM] Client simulating attendee sentiment: "${desc}"`, 'system');

    fetch('/api/simulate/sentiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentimentType: val, text: desc })
    })
    .then(res => res.json())
    .catch(err => {
      console.error(err);
      createToast('Failed to trigger sentiment simulation.', 'warning');
    });
  };
}
