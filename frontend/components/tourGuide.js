// --- INTERACTIVE TOUR SANDBOX GUIDE (QoL) ---

const tourSteps = [
  {
    text: "Drag & Drop: Drag any scheduled session card inside the Live Matrix grid and drop it in another cell to reschedule manually. The Agent will validate and heal any capacity overflows!",
    highlightId: "schedule-table"
  },
  {
    text: "Node Inspector: Click on any circle node in the dynamic network graph. It will open the Database Inspector card below the graph to show linked topics, speakers, and venue capacities.",
    highlightId: "graph-container"
  },
  {
    text: "Self-Healing Solver: Select a speaker from the delays form, choose a delay value, and click 'Trigger'. Watch the Agent write its multi-step logical chain of thoughts in the terminal log!",
    highlightId: "agent-logs"
  },
  {
    text: "Content Pipeline: Drag and drop a text/presentation slides file into the uploader zone. Observe the progress loader simulate ML extraction, generating visual social cards and tweets.",
    highlightId: "drag-zone"
  }
];

let currentTourStep = 0;

function initTourGuide() {
  const card = document.getElementById('tour-card');
  const btnToggle = document.getElementById('btn-toggle-tour');
  const minimizedBar = document.getElementById('tour-minimized-bar');
  const btnNext = document.getElementById('btn-tour-next');
  const btnPrev = document.getElementById('btn-tour-prev');
  const textStep = document.getElementById('tour-step-text');
  const stepInd = document.getElementById('tour-step-indicator');

  if (!card) return;

  // Click on 90-degree vertical minimized bar -> Expand Tour Guide Card
  if (minimizedBar) {
    minimizedBar.addEventListener('click', () => {
      card.classList.remove('collapsed');
      renderTourStep();
    });
  }

  // Click on '-' minimize button -> Collapse into 90-degree vertical tab on right edge
  if (btnToggle) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.add('collapsed');
    });
  }

  // OS Sync Utilities Tour Guide button
  const btnShowTour = document.getElementById('btn-show-tour');
  if (btnShowTour) {
    btnShowTour.addEventListener('click', () => {
      card.classList.remove('collapsed');
      renderTourStep();
    });
  }

  // Next step
  if (btnNext) {
    btnNext.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTourStep = (currentTourStep + 1) % tourSteps.length;
      renderTourStep();
    });
  }

  // Prev step
  if (btnPrev) {
    btnPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      currentTourStep = (currentTourStep - 1 + tourSteps.length) % tourSteps.length;
      renderTourStep();
    });
  }

  function renderTourStep() {
    const step = tourSteps[currentTourStep];
    if (textStep) textStep.textContent = step.text;
    if (stepInd) stepInd.textContent = `${currentTourStep + 1} / ${tourSteps.length}`;
    
    // Highlight elements visually on page
    document.querySelectorAll('.highlight-tour').forEach(el => el.classList.remove('highlight-tour'));
    
    const highlightTarget = document.getElementById(step.highlightId);
    if (highlightTarget) {
      highlightTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightTarget.style.outline = '4px solid var(--google-yellow)';
      setTimeout(() => {
        highlightTarget.style.outline = 'none';
      }, 2000);
    }
  }

  renderTourStep();
}
