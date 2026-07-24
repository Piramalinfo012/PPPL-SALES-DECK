// Canvas Scroll Animation Configuration
const canvas = document.getElementById("scroll-canvas");
const context = canvas.getContext("2d");

const frameCount = 240;
const images = [];
const playhead = { frame: 0 };

// Generate paths for the 240 frames
const currentFrame = index => 
    `plant video_frames_30fps_jpg/frame_${index.toString().padStart(5, '0')}.jpg`;

// Load first frame immediately and rest of the images asynchronously in background (Non-blocking)
function preloadImages() {
    // Pre-allocate slots in images array
    for (let i = 0; i < frameCount; i++) {
        images.push(null);
    }

    // 1. Load the first frame immediately for instant visual feedback
    const firstImg = new Image();
    firstImg.onload = () => {
        images[0] = firstImg;
        renderFrame();
    };
    firstImg.src = currentFrame(0);

    // 2. Load the remaining frames progressively in the background
    for (let i = 1; i < frameCount; i++) {
        const img = new Image();
        img.onload = () => {
            images[i] = img;
            // If user scrolled to this frame while it was loading, draw it
            if (playhead.frame === i) {
                renderFrame();
            }
        };
        img.src = currentFrame(i);
    }
}

// Adjust canvas to match device pixel ratio
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderFrame();
}

// Draw the current frame onto the canvas
function renderFrame() {
    // Find closest loaded frame if the exact one is still downloading
    let activeImage = images[playhead.frame];
    
    if (!activeImage) {
        // Fallback: search backwards for the nearest loaded frame
        for (let i = playhead.frame; i >= 0; i--) {
            if (images[i]) {
                activeImage = images[i];
                break;
            }
        }
    }
    
    if (!activeImage) return;

    // Cover scale logic
    const imgRatio = activeImage.width / activeImage.height;
    const canvasRatio = canvas.width / canvas.height;
    
    let drawWidth, drawHeight, x, y;

    if (canvasRatio > imgRatio) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgRatio;
        x = 0;
        y = (canvas.height - drawHeight) / 2;
    } else {
        drawWidth = canvas.height * imgRatio;
        drawHeight = canvas.height;
        x = (canvas.width - drawWidth) / 2;
        y = 0;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(activeImage, x, y, drawWidth, drawHeight);
}

// Handle scroll tracking
function setupScrollAnimation() {
    window.addEventListener("scroll", () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.min(1, Math.max(0, scrollTop / maxScrollTop));
        
        // Map percentage to frame index
        const frameIndex = Math.min(
            frameCount - 1,
            Math.floor(scrollPercent * frameCount)
        );

        playhead.frame = frameIndex;
        requestAnimationFrame(renderFrame);
    });
}

// ================= DATA FETCHING ENGINE =================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby78sYDNcZE4aMfMv4sRbkyeIHkUCMM5KvbKn49jwb6K9sMQt8ECionyk7rRjEIcI2uLA/exec?sheet=Master";

let sheetDataStore = [];

function isValidUrl(str) {
    if (!str) return false;
    const s = str.trim().toLowerCase();
    return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("www.");
}

function formatUrl(str) {
    if (!str) return "#";
    const s = str.trim();
    if (s.toLowerCase().startsWith("www.")) {
        return "https://" + s;
    }
    return s;
}

async function fetchLiveSheetData() {
    try {
        const response = await fetch(SCRIPT_URL);
        const result = await response.json();
        
        if (!result.success || !result.data) {
            throw new Error(result.error || "Failed to fetch valid data");
        }

        const rawRows = result.data;
        const rawLinks = result.links || [];
        const processes = [];
        
        // Start from index 4 to skip Title and header info
        for (let i = 4; i < rawRows.length; i++) {
            const cells = rawRows[i];
            const linkCells = rawLinks[i] || [];
            if (!cells || !cells[0]) continue;
            
            const getLink = (idx, fallbackText) => {
                const richLink = linkCells[idx];
                if (richLink && isValidUrl(richLink)) {
                    return richLink;
                }
                const textVal = cells[idx];
                return isValidUrl(textVal) ? textVal : '';
            };

            processes.push({
                name: cells[0] || '',
                measurableResult: cells[1] || 'N/A',
                pc: cells[2] || 'N/A',
                problemSolver: cells[3] || 'N/A',
                executive: cells[4] || 'N/A',
                flowchart: getLink(5),
                fms: getLink(6),
                db: getLink(7),
                checklist: getLink(8),
                checklistAuth: cells[9] || 'N/A',
                googleForm: getLink(10),
                trainingVideo: getLink(11),
                productTrainingVideo: getLink(12)
            });
        }
        
        sheetDataStore = processes;
        buildDashboardControls(processes);
        renderProcess(processes[0]);
        updateStats(processes);
        
    } catch (error) {
        console.error("Error loading Sheet operations:", error);
        document.getElementById("dashboard-view").innerHTML = `
            <div class="glass-card" style="text-align: center; color: #ef4444;">
                <p>Failed to load live operation dashboard: ${error.message}</p>
            </div>
        `;
    }
}

function updateStats(processes) {
    document.getElementById("stat-processes-count").innerText = processes.length;
    
    // Count active P.C. roles (unique names)
    const pcs = new Set(processes.map(p => p.pc).filter(name => name && name !== 'N/A'));
    document.getElementById("stat-owners-count").innerText = pcs.size;
}

function buildDashboardControls(processes) {
    const container = document.getElementById("sidebar-controls");
    container.innerHTML = '';
    
    processes.forEach((proc, idx) => {
        const btn = document.createElement("button");
        btn.className = `control-btn ${idx === 0 ? 'active' : ''}`;
        btn.innerText = proc.name;
        btn.addEventListener("click", () => {
            document.querySelectorAll(".control-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderProcess(proc);
        });
        container.appendChild(btn);
    });
}

function renderProcess(proc) {
    const container = document.getElementById("dashboard-view");
    
    container.innerHTML = `
        <div class="process-view glass-card">
            <div class="process-header">
                <h3>${proc.name}</h3>
                <p style="color: var(--accent-cyan); font-weight: 500;">Process Controller: ${proc.pc}</p>
            </div>
            
            <div class="process-grid">
                <div class="detail-card">
                    <h4>Measurable Target</h4>
                    <p>${proc.measurableResult.replace(/\n/g, '<br>')}</p>
                </div>
                
                <div class="detail-card">
                    <h4>Leadership Hierarchy</h4>
                    <p style="margin-bottom: 0.5rem;"><strong>Problem Solver:</strong> ${proc.problemSolver}</p>
                    <p><strong>Executive:</strong> ${proc.executive}</p>
                </div>
                
                <div class="detail-card" style="word-break: break-word;">
                    <h4>Systems & Audits</h4>
                    <p style="margin-bottom: 0.8rem;">
                        <strong>Database:</strong> 
                        ${isValidUrl(proc.db) 
                            ? `<a href="${formatUrl(proc.db)}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline; font-weight: 500;">Open Database</a>` 
                            : proc.db}
                    </p>
                    <p style="margin-bottom: 0.8rem;">
                        <strong>Checklist:</strong> 
                        ${isValidUrl(proc.checklist) 
                            ? `<a href="${formatUrl(proc.checklist)}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline; font-weight: 500;">Open Checklist</a>` 
                            : proc.checklist}
                    </p>
                    <p><strong>Access Creds:</strong> ${proc.checklistAuth}</p>
                </div>
                
                <div class="detail-card">
                    <h4>Resources & Links</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem;">
                        ${isValidUrl(proc.flowchart) ? `<a href="${formatUrl(proc.flowchart)}" target="_blank" class="link-btn">View Flowchart</a>` : ''}
                        ${isValidUrl(proc.fms) ? `<a href="${formatUrl(proc.fms)}" target="_blank" class="link-btn">Access F.M.S</a>` : ''}
                        ${isValidUrl(proc.db) ? `<a href="${formatUrl(proc.db)}" target="_blank" class="link-btn">Access Database (DB)</a>` : ''}
                        ${isValidUrl(proc.checklist) ? `<a href="${formatUrl(proc.checklist)}" target="_blank" class="link-btn">Access Checklist</a>` : ''}
                        ${isValidUrl(proc.googleForm) ? `<a href="${formatUrl(proc.googleForm)}" target="_blank" class="link-btn">Google Form</a>` : ''}
                        ${isValidUrl(proc.trainingVideo) ? `<a href="${formatUrl(proc.trainingVideo)}" target="_blank" class="link-btn">Training Video</a>` : ''}
                        ${isValidUrl(proc.productTrainingVideo) ? `<a href="${formatUrl(proc.productTrainingVideo)}" target="_blank" class="link-btn">Product Video</a>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Initialize Everything
async function init() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    // Start preloading images progressively in background (non-blocking)
    preloadImages();
    
    setupScrollAnimation();
    
    // Setup Scroll Observer for 3D reveal animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    }, observerOptions);

    document.querySelectorAll(".scroll-animate").forEach(el => {
        observer.observe(el);
    });
    
    // Fetch Spreadsheet Data immediately in parallel
    await fetchLiveSheetData();
}

window.onload = init;
