// --- DYNAMIC GRAPH LAYOUT ENGINE (Vanilla Math Spring Simulation) ---

function rebuildGraphData() {
  if (!graphState) return;

  const oldNodeMap = new Map(nodes.map(n => [n.id, n]));
  nodes = [];
  links = [];

  // 1. Add Speaker Nodes
  for (const id in graphState.speakers) {
    const s = graphState.speakers[id];
    const oldNode = oldNodeMap.get(id);
    nodes.push({
      id,
      type: 'speaker',
      label: s.name,
      avatar: s.avatar,
      x: oldNode ? oldNode.x : Math.random() * width,
      y: oldNode ? oldNode.y : Math.random() * height,
      vx: 0,
      vy: 0,
      radius: 20
    });
  }

  // 2. Add Topic Nodes
  for (const id in graphState.topics) {
    const t = graphState.topics[id];
    const oldNode = oldNodeMap.get(id);
    nodes.push({
      id,
      type: 'topic',
      label: t.title.substring(0, 20) + '...',
      x: oldNode ? oldNode.x : Math.random() * width,
      y: oldNode ? oldNode.y : Math.random() * height,
      vx: 0,
      vy: 0,
      radius: 16
    });
  }

  // 3. Add Hall Nodes
  for (const id in graphState.halls) {
    const h = graphState.halls[id];
    const oldNode = oldNodeMap.get(id);
    nodes.push({
      id,
      type: 'hall',
      label: h.name,
      x: oldNode ? oldNode.x : Math.random() * width,
      y: oldNode ? oldNode.y : Math.random() * height,
      vx: 0,
      vy: 0,
      radius: 22
    });
  }

  // 4. Build Links
  graphState.edges.forEach(edge => {
    links.push({
      source: edge.source,
      target: edge.target,
      label: edge.type
    });
  });
}

function physicsTick() {
  if (nodes.length === 0) {
    requestAnimationFrame(physicsTick);
    return;
  }

  const k = 0.04; // Spring stiffness
  const rep = 2200; // Repulsion constant
  const gravity = 0.007; // Center gravity pull
  const damp = 0.82; // Damping constant

  const cx = width / 2;
  const cy = height / 2;

  // A. Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    const n1 = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const n2 = nodes[j];
      if (n1 === draggedNode || n2 === draggedNode) continue;
      
      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      
      const f = rep / (dist * dist);
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;

      n1.vx -= fx;
      n1.vy -= fy;
      n2.vx += fx;
      n2.vy += fy;
    }
  }

  // B. Attraction between connected nodes (springs)
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  links.forEach(link => {
    const n1 = nodeMap.get(link.source);
    const n2 = nodeMap.get(link.target);
    if (!n1 || !n2) return;

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const restLength = 115; // Spring resting length
    
    const force = k * (dist - restLength);
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (n1 !== draggedNode) {
      n1.vx += fx;
      n1.vy += fy;
    }
    if (n2 !== draggedNode) {
      n2.vx -= fx;
      n2.vy -= fy;
    }
  });

  // C. Apply Center Gravity pull, Speed damping, boundary limit check
  nodes.forEach(n => {
    if (n === draggedNode) return;
    
    n.vx += (cx - n.x) * gravity;
    n.vy += (cy - n.y) * gravity;
    
    n.x += n.vx;
    n.y += n.vy;
    
    n.vx *= damp;
    n.vy *= damp;

    n.x = Math.max(n.radius, Math.min(width - n.radius, n.x));
    n.y = Math.max(n.radius, Math.min(height - n.radius, n.y));
  });

  // D. Redraw graph elements
  drawGraphSVG();

  requestAnimationFrame(physicsTick);
}

// Render dynamic graph nodes directly into SVG elements
function drawGraphSVG() {
  const svg = document.getElementById('graph-svg');
  if (!svg) return;
  
  const fragment = document.createDocumentFragment();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Draw links
  links.forEach(l => {
    const s = nodeMap.get(l.source);
    const t = nodeMap.get(l.target);
    if (!s || !t) return;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', s.x);
    line.setAttribute('y1', s.y);
    line.setAttribute('x2', t.x);
    line.setAttribute('y2', t.y);
    line.setAttribute('class', 'graph-link');
    fragment.appendChild(line);
  });

  // Draw nodes
  nodes.forEach(n => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
    g.setAttribute('data-node-id', n.id);
    g.style.cursor = draggedNode === n ? 'grabbing' : 'pointer';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', n.radius);
    
    let isSelectedClass = (selectedNodeId === n.id) ? ' selected-node' : '';
    circle.setAttribute('class', `graph-node ${n.type}${isSelectedClass}`);
    if (selectedNodeId === n.id) {
      circle.style.strokeWidth = '4px';
      circle.style.stroke = '#000';
    }
    g.appendChild(circle);

    const textEmoji = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEmoji.setAttribute('text-anchor', 'middle');
    textEmoji.setAttribute('dy', '4');
    textEmoji.setAttribute('font-size', '14');
    textEmoji.textContent = n.avatar || (n.type === 'topic' ? '📄' : '🏛️');
    g.appendChild(textEmoji);

    const textLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textLabel.setAttribute('y', n.radius + 12);
    textLabel.setAttribute('class', 'graph-label');
    textLabel.setAttribute('text-anchor', 'middle');
    textLabel.textContent = n.label.length > 15 ? n.label.substring(0, 12) + '...' : n.label;
    g.appendChild(textLabel);

    fragment.appendChild(g);
  });

  svg.innerHTML = '';
  svg.appendChild(fragment);
}

// Mouse dragging in graph network
function initSvgMouseHandlers() {
  const svg = document.getElementById('graph-svg');
  if (!svg) return;

  svg.addEventListener('mousedown', (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check if clicked near a node
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dx = n.x - mx;
      const dy = n.y - my;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist <= n.radius + 5) {
        draggedNode = n;
        isMouseDragging = false;
        dragStartX = mx;
        dragStartY = my;
        break;
      }
    }
  });

  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (draggedNode) {
      if (Math.abs(mx - dragStartX) > 4 || Math.abs(my - dragStartY) > 4) {
        isMouseDragging = true;
      }

      draggedNode.x = mx;
      draggedNode.y = my;
      draggedNode.vx = 0;
      draggedNode.vy = 0;
      return;
    }

    // Hover check over graph nodes to position hover popover card right next to the node!
    let hoveredNode = null;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dist = Math.sqrt((n.x - mx)**2 + (n.y - my)**2);
      if (dist <= n.radius + 6) {
        hoveredNode = n;
        break;
      }
    }

  });

  svg.addEventListener('mouseleave', () => {
    hoveredNode = null;
  });

  window.addEventListener('mouseup', (e) => {
    if (draggedNode) {
      if (!isMouseDragging) {
        selectGraphNode(draggedNode.id);
      }
      draggedNode = null;
    }
  });
}

// --- GRAPH DATABASE NODE INSPECTOR CARD ---

function selectGraphNode(nodeId) {
  selectedNodeId = nodeId;
  const inspector = document.getElementById('node-inspector');
  const body = document.getElementById('inspector-body');

  if (!graphState || !inspector || !body) return;

  inspector.style.display = 'block';

  // 1. Speaker Node
  if (graphState.speakers[nodeId]) {
    const s = graphState.speakers[nodeId];
    let speakerTalks = [];
    for (const tId in graphState.topics) {
      if (graphState.topics[tId].speakerId === nodeId) {
        speakerTalks.push(graphState.topics[tId]);
      }
    }

    body.innerHTML = `
      <div class="inspector-section">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">${s.avatar}</div>
        <h3 style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono);">${s.name}</h3>
        <p style="font-size:0.9rem; font-weight:700; color:var(--google-blue);">${s.role}</p>
        <p style="font-size:0.85rem; margin-top:5px; font-weight:500;">${s.bio}</p>
      </div>
      <div class="inspector-section">
        <h4>Linked Talk Sessions:</h4>
        ${speakerTalks.map(t => `
          <div style="border: 1px solid #000; border-radius:6px; padding:6px; background:#faf9f6; margin-bottom:6px; font-size:0.85rem;">
            <strong style="font-weight:700;">${t.title}</strong>
            <div style="font-size:0.75rem; color:#666; margin-top:3px; display:flex; justify-content:space-between;">
              <span>Interest: 🔥 ${t.interest} pax</span>
              <span>Duration: ⏱️ ${t.duration}m</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="inspector-section">
        <h4>Status Parameters:</h4>
        <div class="inspector-meta-row">
          <span>Flight Status Delay:</span>
          <span style="font-weight:700; color:${s.delay > 0 ? 'var(--google-red)' : 'var(--google-green)'}">
            ${s.delay > 0 ? `+${s.delay} minutes (Delayed)` : 'Normal / On-time'}
          </span>
        </div>
      </div>
    `;
  }

  // 2. Topic Node
  else if (graphState.topics[nodeId]) {
    const t = graphState.topics[nodeId];
    const s = graphState.speakers[t.speakerId];
    
    let slotTime = "Not Scheduled";
    let hallName = "Not Scheduled";
    for (const slotId in scheduleState) {
      for (const hallId in scheduleState[slotId]) {
        if (scheduleState[slotId][hallId] === nodeId) {
          slotTime = graphState.slots[slotId].time;
          hallName = graphState.halls[hallId].name;
        }
      }
    }

    body.innerHTML = `
      <div class="inspector-section">
        <h3 style="font-size:1.1rem; font-weight:800; line-height:1.2; font-family:var(--font-mono);">${t.title}</h3>
        <p style="font-size:0.85rem; color:#666; margin-top:4px;">Presenter: <strong style="font-weight:700;">${s.avatar} ${s.name}</strong></p>
        <p style="font-size:0.85rem; color:#555; margin-top:5px; font-style:italic;">${t.summary || 'Presentation slides uploaded successfully. Database linked.'}</p>
      </div>
      <div class="inspector-section">
        <h4>Slide Pipeline Metadata tags:</h4>
        <div class="tag-row">
          ${t.tags.map(tag => `<span class="inspector-tag">#${tag}</span>`).join('')}
        </div>
      </div>
      <div class="inspector-section">
        <h4>Schedule Mapping Details:</h4>
        <div class="inspector-meta-row">
          <span>Target Venue Hall:</span>
          <span style="font-weight:700;">🏛️ ${hallName}</span>
        </div>
        <div class="inspector-meta-row">
          <span>Scheduled Time Slot:</span>
          <span style="font-weight:700;">⏱️ ${slotTime}</span>
        </div>
        <div class="inspector-meta-row">
          <span>Audience Interest Volume:</span>
          <span style="font-weight:700; color:var(--google-blue);">🔥 ${t.interest} attendees</span>
        </div>
      </div>
    `;
  }

  // 3. Hall Node
  else if (graphState.halls[nodeId]) {
    const h = graphState.halls[nodeId];
    
    let scheduledTalks = [];
    for (const slotId in scheduleState) {
      const tId = scheduleState[slotId][nodeId];
      if (tId) {
        scheduledTalks.push({
          time: graphState.slots[slotId].time,
          topic: graphState.topics[tId],
          speaker: graphState.speakers[graphState.topics[tId].speakerId]
        });
      }
    }

    body.innerHTML = `
      <div class="inspector-section">
        <h3 style="font-size:1.2rem; font-weight:800; font-family:var(--font-mono);">🏛️ ${h.name}</h3>
        <p style="font-size:0.9rem; font-weight:600; color:#555;">Max Facility Capacity: <strong style="font-weight:700;">${h.capacity} Pax</strong></p>
      </div>
      <div class="inspector-section">
        <h4>Active Schedule in this Hall:</h4>
        ${scheduledTalks.length === 0 ? '<p style="font-size:0.8rem; font-style:italic;">No sessions scheduled in this hall.</p>' : 
          scheduledTalks.map(item => `
          <div style="border: 1px solid #000; border-radius:6px; padding:6px; background:#faf9f6; margin-bottom:6px; font-size:0.85rem;">
            <div style="font-size:0.75rem; font-weight:700; color:var(--google-blue);">${item.time}</div>
            <strong style="font-weight:700; display:block; margin-top:2px;">${item.topic.title}</strong>
            <span style="font-size:0.75rem; color:#555; display:inline-block; margin-top:2px;">
              Speaker: ${item.speaker.avatar} ${item.speaker.name}
            </span>
          </div>
        `).join('')}
      </div>
    `;
  }

  inspector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function initNodeInspectorClose() {
  const inspector = document.getElementById('node-inspector');
  if (!inspector) return;
  
  const btnClose = inspector.querySelector('.btn-close-inspector');
  if (btnClose) {
    btnClose.onclick = () => {
      selectedNodeId = null;
      inspector.style.display = 'none';
      drawGraphSVG();
    };
  }
}
