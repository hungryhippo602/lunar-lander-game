// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const restartButton = document.getElementById('restartButton');
restartButton.addEventListener('click', () => {
    location.reload();
});

// Lander object
const lander = {
    x: 400,          // Center of canvas
    y: 100,          // Near top
    vx: 0,           // Horizontal velocity
    vy: 0,           // Vertical velocity
    angle: 0,        // Angle in radians (0 is upright)
    thrusting: false,
    rotatingLeft: false,
    rotatingRight: false,
    fuel: 150        // Fuel units
};

// Constants
// ***** CHANGE THIS LINE *****
const GRAVITY = 3.5;     // Moon gravity (pixels/s²) - Increased from 3
// *****------------------*****
const THRUST_ACC = 8;    // Thrust acceleration (pixels/s²)
const ROTATION_SPEED = 2;   // Rotation speed (rad/s)

// Generate terrain with flat spots
function generateTerrain() {
    const terrain = [];
    let x = 0;
    let y = 550; // Near bottom
    let flatSpotsGenerated = 0; // Keep track of flat spots
    const minFlatSpots = 2; // Ensure at least 2 flat spots

    while (x < 800) {
        // Try to generate a flat spot if needed or by chance
        const shouldTryFlat = (flatSpotsGenerated < minFlatSpots && x > 100 && x < 700); // Ensure spots aren't right at edges
        const randomChance = Math.random() < 0.25; // Reduced chance slightly

        if ( (shouldTryFlat || randomChance) && x < 700 ) { // Ensure enough space for the flat spot width
             const flatWidth = 40 + Math.random() * 20; // Make flat spots slightly narrower (40-60px)
             const startX = x;
             for (let i = 0; i * 10 < flatWidth && x < 800; i++) {
                 terrain.push({ x: x, y: y });
                 x += 10;
             }
             console.log(`Generated flat spot at Y=${y} from X=${startX} to X=${x}`);
             flatSpotsGenerated++;
        } else {
            y += (Math.random() - 0.5) * 25; // Slightly more variation
            y = Math.max(480, Math.min(600, y)); // Allow slightly deeper valleys
            terrain.push({ x: x, y: y });
            x += 10;
        }
    }
    // Ensure the terrain reaches the edge
    if (terrain.length > 0 && terrain[terrain.length - 1].x < 800) {
        terrain.push({ x: 800, y: terrain[terrain.length - 1].y });
    } else if (terrain.length === 0) {
        terrain.push({x: 0, y: 550});
        terrain.push({x: 800, y: 550});
    }
     // Failsafe: If not enough flat spots generated, add one near the middle
    if (flatSpotsGenerated < minFlatSpots) {
         console.warn("Not enough flat spots generated, adding one manually.");
         const flatY = 530 + Math.random() * 40; // Random height for manual spot
         const flatXStart = 350;
         const flatWidthManual = 50;
         // Remove existing points in the range
         const removeIndexStart = terrain.findIndex(p => p.x >= flatXStart);
         const removeIndexEnd = terrain.findIndex(p => p.x >= flatXStart + flatWidthManual);
         if (removeIndexStart !== -1) {
             const deleteCount = (removeIndexEnd !== -1) ? removeIndexEnd - removeIndexStart : terrain.length - removeIndexStart;
             terrain.splice(removeIndexStart, deleteCount);
             // Add new flat points
             const pointsToAdd = [];
             for (let i = 0; i * 10 < flatWidthManual; i++) {
                 pointsToAdd.push({ x: flatXStart + i * 10, y: flatY });
             }
             // Add a point connecting back to the original terrain if possible
             if (removeIndexEnd !== -1 && removeIndexEnd < terrain.length) {
                 pointsToAdd.push({ x: terrain[removeIndexEnd].x, y: flatY}); // Connect end y
             } else if (removeIndexStart > 0) {
                  pointsToAdd.push({ x: 800, y: flatY}); // Go to edge if needed
             }
             terrain.splice(removeIndexStart, 0, ...pointsToAdd);
              // Ensure terrain is sorted by x after manual insertion
             terrain.sort((a, b) => a.x - b.x);
             // Remove duplicate x values if any occurred
             for(let i = terrain.length - 1; i > 0; i--) {
                 if (terrain[i].x === terrain[i-1].x) {
                     terrain.splice(i, 1);
                 }
             }
         }
    }


    return terrain;
}
const terrain = generateTerrain();

// Generate stars for background
const stars = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: -20 // Move left at 20 pixels per second
    });
}

// Explosion particles array
const explosionParticles = [];

// Function to create explosion particles
function createExplosion(x, y) {
    const particleCount = 30; // Number of particles
    for (let i = 0; i < particleCount; i++) {
        explosionParticles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 12, // Slightly faster particles
            vy: (Math.random() - 0.5) * 12,
            size: Math.random() * 5 + 2, // Size between 2 and 7
            life: 1.5, // Slightly longer life
            decay: 2.0 // Faster decay rate relative to longer life
        });
    }
}

// Key controls
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') lander.thrusting = true;
    if (e.key === 'ArrowLeft') lander.rotatingLeft = true;
    if (e.key === 'ArrowRight') lander.rotatingRight = true;
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') lander.thrusting = false;
    if (e.key === 'ArrowLeft') lander.rotatingLeft = false;
    if (e.key === 'ArrowRight') lander.rotatingRight = false;
});

// Game state
let gameOver = false;
let landedSuccessfully = false;
let previousTime = performance.now();

// Game loop
function gameLoop(currentTime) {
    const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05); // Cap deltaTime to prevent physics jumps
    previousTime = currentTime;

    // Update stars
    stars.forEach(star => {
        star.x += star.vx * deltaTime;
        if (star.x < 0) {
            star.x = 800;
            star.y = Math.random() * 600; // Reposition y for variety
        }
    });

    if (!gameOver) {
        update(deltaTime);
    }

    // Update explosion particles
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const particle = explosionParticles[i];
        particle.vy += GRAVITY * 0.5 * deltaTime; // Gravity affects particles
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay * deltaTime;
        if (particle.life <= 0) {
            explosionParticles.splice(i, 1);
        }
    }

    draw();
    requestAnimationFrame(gameLoop);
}

// Update game state
function update(deltaTime) {
    // Rotation
    if (lander.rotatingLeft) lander.angle -= ROTATION_SPEED * deltaTime;
    if (lander.rotatingRight) lander.angle += ROTATION_SPEED * deltaTime;

    // Thrust
    if (lander.thrusting && lander.fuel > 0) {
        lander.vx += THRUST_ACC * Math.sin(lander.angle) * deltaTime;
        lander.vy -= THRUST_ACC * Math.cos(lander.angle) * deltaTime;
        // ***** CHANGE THIS LINE *****
        lander.fuel -= 3.0 * deltaTime; // Increased fuel consumption from 2.5
        // *****------------------*****
        if (lander.fuel < 0) lander.fuel = 0;
    }

    // Gravity (uses the new GRAVITY constant)
    lander.vy += GRAVITY * deltaTime;

    // Update position
    lander.x += lander.vx;
    lander.y += lander.vy;

    // Keep lander within horizontal bounds
    if (lander.x < 5) { lander.x = 5; lander.vx = 0; }
    if (lander.x > 795) { lander.x = 795; lander.vx = 0; }

     // Check for out of bounds top (crash)
    if (lander.y < -30) {
        console.log("CRASH! Went off top of screen.");
        gameOver = true;
        landedSuccessfully = false;
        createExplosion(lander.x, 10);
        restartButton.style.display = 'block';
        lander.vx = 0; lander.vy = 0;
        return;
    }


    // Collision detection with lander bottom
    const landerBottomY = lander.y + 20;
    const terrainY = getTerrainY(lander.x);

    if (landerBottomY > terrainY) {
        lander.y = terrainY - 20;

        const { isFlat, flatnessDiff } = isFlatSpot(lander.x);
        // ***** CHANGE THESE LINES *****
        const maxAngle = 0.7;   // Stricter angle limit (~40.1 degrees), was 1.0
        const maxVy = 3.5;    // Stricter vertical speed limit, was 4.5
        const maxVx = 4.0;    // Stricter horizontal speed limit, was 5.5
        // *****--------------------*****

        const isUpright = Math.abs(lander.angle) < maxAngle;
        const isSlow = Math.abs(lander.vy) < maxVy && Math.abs(lander.vx) < maxVx;

        // Logging will now reflect the new stricter limits
        console.log(`Landing attempt: isFlat=${isFlat} (Diff: ${flatnessDiff.toFixed(2)}), isUpright=${isUpright} (Angle: ${(lander.angle * 180 / Math.PI).toFixed(1)}°), isSlow=${isSlow} (Vy: ${lander.vy.toFixed(2)}, Vx: ${lander.vx.toFixed(2)})`);
        console.log(`Landing Params Used: MaxAngle=${(maxAngle * 180 / Math.PI).toFixed(1)}°, MaxVy=${maxVy.toFixed(2)}, MaxVx=${maxVx.toFixed(2)}`);

        if (isFlat && isUpright && isSlow) {
            landedSuccessfully = true;
            console.log("SUCCESSFUL LANDING!");
            lander.angle = 0;
        } else {
            landedSuccessfully = false;
            createExplosion(lander.x, lander.y);
            console.log("CRASH!");
            // Log reasons (will trigger more often now)
            if (!isFlat) console.log(` -> Reason: Not flat enough (Diff: ${flatnessDiff.toFixed(2)} >= 1).`); // Updated flatness diff check value in log
            if (!isUpright) console.log(` -> Reason: Angle too high (|${(lander.angle * 180 / Math.PI).toFixed(1)}°| >= ${(maxAngle * 180 / Math.PI).toFixed(1)}°).`);
            if (!isSlow) {
                if (Math.abs(lander.vy) >= maxVy) console.log(` -> Reason: Vertical speed too high (|${lander.vy.toFixed(2)}| m/s >= ${maxVy.toFixed(2)} m/s).`);
                if (Math.abs(lander.vx) >= maxVx) console.log(` -> Reason: Horizontal speed too high (|${lander.vx.toFixed(2)}| m/s >= ${maxVx.toFixed(2)} m/s).`);
            }
        }
        gameOver = true;
        restartButton.style.display = 'block';
        lander.vx = 0; lander.vy = 0;
        lander.thrusting = false; lander.rotatingLeft = false; lander.rotatingRight = false;
    }
}

// Get terrain height at x using linear interpolation
function getTerrainY(x) {
    if (terrain.length < 2) return canvas.height; // Need at least 2 points for segments
    if (x <= terrain[0].x) return terrain[0].y;
    if (x >= terrain[terrain.length - 1].x) return terrain[terrain.length - 1].y;

    for (let i = 0; i < terrain.length - 1; i++) {
        const p1 = terrain[i];
        const p2 = terrain[i+1];
        // Ensure p1 and p2 are valid points
        if (!p1 || !p2) continue;
        // Ensure x coordinates are ordered (safeguard against potential issues from manual insertion)
        if (p1.x >= p2.x) continue;

        if (x >= p1.x && x < p2.x) {
            const t = (x - p1.x) / (p2.x - p1.x);
            // Ensure t is valid
             if (!isFinite(t)) return p1.y;
            return p1.y + t * (p2.y - p1.y);
        }
    }
    console.warn("Terrain Y lookup failed for x =", x, "- returning last point Y:", terrain[terrain.length-1].y);
    return terrain[terrain.length - 1].y; // Fallback
}

// Check for flat spot and return flatness difference
function isFlatSpot(x) {
    const range = 15;
    let minY = Infinity;
    let maxY = -Infinity;
    let pointCount = 0;

    const checkStartX = Math.max(0, x - range);
    const checkEndX = Math.min(canvas.width, x + range);

    // Find relevant terrain segment indices
    let startIndex = terrain.findIndex(p => p.x >= checkStartX);
    let endIndex = terrain.findIndex(p => p.x >= checkEndX);

    if (startIndex === -1) startIndex = 0; // If check starts before terrain begins
    else startIndex = Math.max(0, startIndex - 1); // Start checking from the segment before

    if (endIndex === -1) endIndex = terrain.length - 1; // If check ends after terrain ends

    // Iterate through points within the relevant segment indices
    for (let i = startIndex; i <= endIndex; i++) {
        if (terrain[i] && terrain[i].x >= checkStartX && terrain[i].x <= checkEndX) {
            minY = Math.min(minY, terrain[i].y);
            maxY = Math.max(maxY, terrain[i].y);
            pointCount++;
        }
    }

    // Add interpolated points at the precise check boundaries for better accuracy
    if (pointCount > 0) {
        const yAtStart = getTerrainY(checkStartX);
        const yAtEnd = getTerrainY(checkEndX);
        if (isFinite(yAtStart)) { minY = Math.min(minY, yAtStart); maxY = Math.max(maxY, yAtStart); }
        if (isFinite(yAtEnd)) { minY = Math.min(minY, yAtEnd); maxY = Math.max(maxY, yAtEnd); }
    }

    const flatnessDiff = (pointCount > 0 && isFinite(minY) && isFinite(maxY)) ? maxY - minY : Infinity;
    // ***** CHANGE THIS LINE *****
    const isFlat = flatnessDiff < 1.0; // Stricter flatness check, was 2.0
    // *****------------------*****
    return { isFlat, flatnessDiff };
}


// --- DRAW FUNCTION REMAINS UNCHANGED ---
function draw() {
    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stars
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.fillRect(star.x, star.y, 1, 1);
    });

    // Draw terrain
    ctx.fillStyle = 'gray';
    ctx.beginPath();
    if (terrain.length > 0) {
        ctx.moveTo(terrain[0].x, terrain[0].y);
        for (let i = 1; i < terrain.length; i++) {
            // Ensure point exists before drawing
            if(terrain[i]) ctx.lineTo(terrain[i].x, terrain[i].y);
        }
        ctx.lineTo(terrain[terrain.length - 1].x, canvas.height);
        ctx.lineTo(terrain[0].x, canvas.height);
    }
    ctx.closePath();
    ctx.fill();


    // Draw turquoise line slightly below flat terrain segments
    ctx.strokeStyle = '#00CED1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < terrain.length - 1; i++) {
        // Check if both points exist
        if (!terrain[i] || !terrain[i+1]) continue;
        // Check if the segment *itself* is almost perfectly flat (small tolerance)
        // AND if the broader area check passes
        if (Math.abs(terrain[i].y - terrain[i+1].y) < 0.1) {
             const midPointX = (terrain[i].x + terrain[i+1].x) / 2;
             if (isFlatSpot(midPointX).isFlat) { // Use the strict check here
                 ctx.moveTo(terrain[i].x, terrain[i].y + 2);
                 ctx.lineTo(terrain[i+1].x, terrain[i+1].y + 2);
             }
        }
    }
    ctx.stroke();


    // Draw flag on successful landing
    if (landedSuccessfully) {
        const flagWidth = 30;
        const poleHeight = 40;
        const flagHeight = 21;
        const flagX = Math.max(10, Math.min(lander.x + 20, canvas.width - flagWidth - 5));
        const terrainYAtFlag = getTerrainY(flagX);

        // Draw pole
        ctx.strokeStyle = 'darkgray'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(flagX, terrainYAtFlag); ctx.lineTo(flagX, terrainYAtFlag - poleHeight); ctx.stroke();

        // Draw stripes
        const stripeHeight = flagHeight / 7;
        for (let i = 0; i < 7; i++) {
            ctx.fillStyle = (i % 2 === 0) ? '#FF0000' : '#FFFFFF';
            let stripeY = terrainYAtFlag - poleHeight + i * stripeHeight;
            ctx.fillRect(flagX, stripeY, flagWidth, stripeHeight + 0.5);
        }
        // Draw canton
        const cantonWidth = flagWidth * 0.4; const cantonHeight = stripeHeight * 4;
        ctx.fillStyle = '#0000FF'; ctx.fillRect(flagX, terrainYAtFlag - poleHeight, cantonWidth, cantonHeight);
        // Draw stars
        ctx.fillStyle = 'white'; const starSize = 1;
        ctx.fillRect(flagX + cantonWidth * 0.2, terrainYAtFlag - poleHeight + cantonHeight * 0.2, starSize, starSize);
        ctx.fillRect(flagX + cantonWidth * 0.6, terrainYAtFlag - poleHeight + cantonHeight * 0.2, starSize, starSize);
        ctx.fillRect(flagX + cantonWidth * 0.4, terrainYAtFlag - poleHeight + cantonHeight * 0.5, starSize, starSize);
        ctx.fillRect(flagX + cantonWidth * 0.2, terrainYAtFlag - poleHeight + cantonHeight * 0.8, starSize, starSize);
        ctx.fillRect(flagX + cantonWidth * 0.6, terrainYAtFlag - poleHeight + cantonHeight * 0.8, starSize, starSize);
    }

    // Draw explosion particles
    explosionParticles.forEach(particle => {
        const alpha = Math.max(0, particle.life / 1.5);
        const r = 255; const g = Math.floor(Math.random() * 155) + 100; const b = 0;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
    });

    // --- Draw Lander ---
    const terrainYDistCheck = getTerrainY(lander.x);
    const landerBottomDistCheck = lander.y + 20;
    let distance = terrainYDistCheck - landerBottomDistCheck;

    if (!isFinite(distance)) {
        console.warn(`Invalid distance calculated in draw() [${distance}] at lander y=${lander.y.toFixed(2)}, terrainY=${terrainYDistCheck.toFixed(2)}. Using safe fallback.`);
        distance = canvas.height;
    }

    if (!gameOver || landedSuccessfully) {
        const { isFlat: isOverFlat } = isFlatSpot(lander.x);
        // Visual warning conditions (can keep these slightly less strict than landing)
        const closeLandingDistance = 50;
        const closeLandingMaxVy = 2.5; // Stricter visual warning
        const closeLandingMaxAngle = 0.4; // Stricter visual warning

        const isCloseToLandingSafe = !gameOver && isOverFlat && distance > 0 && distance < closeLandingDistance && Math.abs(lander.vy) < closeLandingMaxVy && Math.abs(lander.angle) < closeLandingMaxAngle;

        let landerColor = 'silver';
        if (gameOver && landedSuccessfully) { landerColor = 'lime'; }
        else if (isCloseToLandingSafe) {
            const pulse = Math.abs(Math.sin(performance.now() / 200));
            const greenComponent = Math.floor(180 + 75 * pulse);
            landerColor = `rgb(192, ${greenComponent}, 192)`;
        }

        ctx.save();
        ctx.translate(lander.x, lander.y);
        ctx.rotate(lander.angle);

        const bodyWidth = 10; const bodyHeight = 35;
        ctx.fillStyle = landerColor; ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight);
        // Nose Cone
        ctx.beginPath(); ctx.moveTo(0, -bodyHeight / 2 - 8); ctx.lineTo(-bodyWidth / 2, -bodyHeight / 2); ctx.lineTo(bodyWidth / 2, -bodyHeight / 2); ctx.closePath(); ctx.fill();
        // Fins
        const finBaseY = bodyHeight / 2 - 5; const finTipY = bodyHeight / 2; const finWidth = 5;
        ctx.beginPath(); ctx.moveTo(-bodyWidth / 2, finBaseY); ctx.lineTo(-bodyWidth / 2 - finWidth, finTipY); ctx.lineTo(-bodyWidth / 2, finTipY); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bodyWidth / 2, finBaseY); ctx.lineTo(bodyWidth / 2 + finWidth, finTipY); ctx.lineTo(bodyWidth / 2, finTipY); ctx.closePath(); ctx.fill();
        // Landing Legs
        const legDeployDistance = 60; const legRetractedLength = 5; const legExtendedLength = 15; const legAngle = Math.PI / 4;
        let legLength = legRetractedLength;
        if (distance >= 0 && distance < legDeployDistance) { legLength = legRetractedLength + (legExtendedLength - legRetractedLength) * (1 - distance / legDeployDistance); }
        else if (distance < 0) { legLength = legExtendedLength; }
        if (!isFinite(legLength)) { legLength = legRetractedLength; }
        const legBaseY = bodyHeight / 2; ctx.strokeStyle = landerColor; ctx.lineWidth = 2;
        // Left Leg
        ctx.beginPath(); ctx.moveTo(-bodyWidth / 2, legBaseY); ctx.lineTo(-bodyWidth / 2 - legLength * Math.cos(legAngle), legBaseY + legLength * Math.sin(legAngle)); ctx.stroke();
        // Right Leg
        ctx.beginPath(); ctx.moveTo(bodyWidth / 2, legBaseY); ctx.lineTo(bodyWidth / 2 + legLength * Math.cos(legAngle), legBaseY + legLength * Math.sin(legAngle)); ctx.stroke();
        // Thrust flame
        if (lander.thrusting && lander.fuel > 0 && !gameOver) {
            const flameHeight = 15 + Math.random() * 15; const flameBaseY = bodyHeight / 2;
            const gradient = ctx.createLinearGradient(0, flameBaseY, 0, flameBaseY + flameHeight);
            gradient.addColorStop(0, 'white'); gradient.addColorStop(0.3, 'yellow'); gradient.addColorStop(0.7, 'orange'); gradient.addColorStop(1, 'rgba(255,0,0,0.5)');
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.moveTo(-bodyWidth / 2 * 0.8, flameBaseY); ctx.lineTo(bodyWidth / 2 * 0.8, flameBaseY); ctx.lineTo(0, flameBaseY + flameHeight); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }

    // --- Draw HUD ---
    ctx.fillStyle = 'white'; ctx.font = '14px Arial'; ctx.textAlign = 'left';
    // Fuel bar
    const fuelBarWidth = 100; const fuelBarHeight = 10; const fuelX = 10; const fuelY = 45;
    ctx.strokeStyle = 'white'; ctx.strokeRect(fuelX, fuelY, fuelBarWidth, fuelBarHeight);
    const currentFuelWidth = fuelBarWidth * Math.max(0, lander.fuel / 150);
    ctx.fillStyle = lander.fuel < 30 ? 'red' : (lander.fuel < 75 ? 'yellow' : 'green');
    ctx.fillRect(fuelX, fuelY, currentFuelWidth, fuelBarHeight);
    ctx.fillStyle = 'white'; ctx.fillText(`Fuel: ${lander.fuel.toFixed(0)}`, fuelX + fuelBarWidth + 5, fuelY + fuelBarHeight);
    // Other HUD
    ctx.fillText(`Vert Speed: ${lander.vy.toFixed(1)}`, 10, 75);
    ctx.fillText(`Horiz Speed: ${lander.vx.toFixed(1)}`, 10, 95);
    ctx.fillText(`Angle: ${(lander.angle * 180 / Math.PI).toFixed(1)}°`, 10, 115);
    const altitude = Math.max(0, distance); ctx.fillText(`Altitude: ${altitude.toFixed(0)}`, 10, 135);

    // Instructions
    if (!gameOver) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.font = '12px Arial'; ctx.textAlign = 'right';
        const instructionX = canvas.width - 10; const instructionY = 30;
        ctx.fillText('Controls:', instructionX, instructionY);
        ctx.fillText('↑ Thrust', instructionX, instructionY + 15);
        ctx.fillText('← Rotate Left', instructionX, instructionY + 30);
        ctx.fillText('→ Rotate Right', instructionX, instructionY + 45);
    }

        // Game over message
    if (gameOver) {
        ctx.fillStyle = landedSuccessfully ? 'lime' : 'red'; ctx.font = '40px Arial Black'; ctx.textAlign = 'center';
        ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
        const message = landedSuccessfully ? 'LANDING SUCCESSFUL!' : 'CRASHED!';
        const messageY = canvas.height / 2 - 20;
        ctx.strokeText(message, canvas.width / 2, messageY); ctx.fillText(message, canvas.width / 2, messageY);

        // Score/info
        ctx.font = '18px Arial'; ctx.fillStyle = 'white';
        if (landedSuccessfully) {
            // --- COMMENT OUT OR DELETE THESE TWO LINES ---
            // ctx.fillText(`Remaining Fuel: ${lander.fuel.toFixed(0)}`, canvas.width / 2, messageY + 40);
            // ctx.fillText(`Final Vertical Speed: ${Math.abs(lander.vy).toFixed(2)}`, canvas.width / 2, messageY + 60);
            // --- -------------------------------------- ---
        } else {
            // This message still shows on crash
            ctx.fillText('Better luck next time!', canvas.width / 2, messageY + 40);
        }
    }
}


// Start game
requestAnimationFrame(gameLoop);