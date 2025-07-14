const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;
const Render = Matter.Render;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;
const Constraint = Matter.Constraint;
const Events = Matter.Events;

class BallsInBoxesGame {
    constructor() {
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.gameWon = false;
        
        this.balls = [];
        this.boxes = [];
        this.gameColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff']; // Red, Green, Blue, Yellow, Purple
        this.walls = [];
        
        this.ballsFixed = false; // false = boxes fixed, balls move; true = balls fixed, boxes move
        
        this.gravityAngle = Math.PI / 2; // Start pointing down
        this.baseGravityStrength = 1;
        this.gravityStrength = 1;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;
        
        // Double-tap detection
        this.lastTapTime = 0;
        this.doubleTapDelay = 300; // milliseconds
        
        // Double-click detection (separate from touch)
        this.lastClickTime = 0;
        this.doubleClickDelay = 300; // milliseconds
        
        // Gradient colors
        this.gradientColor1 = '#99c1f1';
        this.gradientColor2 = '#62a0ea';
        this.gradientColor3 = '#1a5fb4';
        
        this.init();
    }
    
    init() {
        console.log('Initializing game...');
        this.setupCanvas();
        console.log('Canvas size:', this.width, 'x', this.height);
        this.setupPhysics();
        this.createWalls();
        console.log('Walls created:', this.walls.length);
        this.setupTouchControls();
        this.setupColorControls();
        this.setupCollisionDetection();
        this.gameLoop();
        this.initializeGame();
    }
    
    setupCanvas() {
        const container = document.getElementById('gameContainer');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }
    
    setupPhysics() {
        this.engine.world.gravity.y = 1;
        this.engine.world.gravity.x = 0;
        
        // Don't use Matter.js renderer - we'll do custom rendering
        Engine.run(this.engine);
    }
    
    setupCollisionDetection() {
        Events.on(this.engine, 'collisionStart', (event) => {
            const pairs = event.pairs;
            
            pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;
                
                // Check if both bodies are closed boxes (solid squares)
                const boxA = this.boxes.find(box => box.solidSquare === bodyA);
                const boxB = this.boxes.find(box => box.solidSquare === bodyB);
                
                if (boxA && boxB && boxA.ballColor === boxB.ballColor) {
                    // Same color collision detected
                    this.handleSquareCollision(boxA, boxB);
                }
            });
        });
    }
    
    createWalls() {
        const thickness = 100;
        
        this.walls = [
            Bodies.rectangle(this.width / 2, -thickness / 2, this.width, thickness, {
                isStatic: true,
                render: { fillStyle: '#333' }
            }),
            Bodies.rectangle(this.width / 2, this.height + thickness / 2, this.width, thickness, {
                isStatic: true,
                render: { fillStyle: '#333' }
            }),
            Bodies.rectangle(-thickness / 2, this.height / 2, thickness, this.height, {
                isStatic: true,
                render: { fillStyle: '#333' }
            }),
            Bodies.rectangle(this.width + thickness / 2, this.height / 2, thickness, this.height, {
                isStatic: true,
                render: { fillStyle: '#333' }
            })
        ];
        
        World.add(this.world, this.walls);
    }
    
    setupColorControls() {
        // Add event listeners for color selectors
        const color1Input = document.getElementById('color1');
        const color2Input = document.getElementById('color2');
        const color3Input = document.getElementById('color3');
        
        color1Input.addEventListener('input', (event) => {
            this.gradientColor1 = event.target.value;
        });
        
        color2Input.addEventListener('input', (event) => {
            this.gradientColor2 = event.target.value;
        });
        
        color3Input.addEventListener('input', (event) => {
            this.gradientColor3 = event.target.value;
        });
    }
    
    createSquareBox(x, y, color, boxSize = 70) {
        const thickness = 6;
        
        // Randomly select which side to leave open (0=top, 1=right, 2=bottom, 3=left)
        const openSide = Math.floor(Math.random() * 4);
        
        const walls = [];
        
        // Create walls based on which side is open
        if (openSide !== 2) { // Bottom wall (unless bottom is open)
            walls.push(Bodies.rectangle(x, y + boxSize / 2 - thickness / 2, boxSize, thickness, {
                render: { fillStyle: '#666' }
            }));
        }
        
        if (openSide !== 0) { // Top wall (unless top is open)
            walls.push(Bodies.rectangle(x, y - boxSize / 2 + thickness / 2, boxSize, thickness, {
                render: { fillStyle: '#666' }
            }));
        }
        
        if (openSide !== 3) { // Left wall (unless left is open)
            walls.push(Bodies.rectangle(x - boxSize / 2 + thickness / 2, y, thickness, boxSize, {
                render: { fillStyle: '#666' }
            }));
        }
        
        if (openSide !== 1) { // Right wall (unless right is open)
            walls.push(Bodies.rectangle(x + boxSize / 2 - thickness / 2, y, thickness, boxSize, {
                render: { fillStyle: '#666' }
            }));
        }
        
        // Create a compound body from the walls
        const compoundBox = Body.create({
            parts: walls,
            isStatic: !this.ballsFixed,
            restitution: 0.4,
            friction: 0.5,
            frictionAir: 0.005,
            frictionStatic: 0.8,
            render: { visible: false } // Hide the compound body's own render shape
        });
        
        // Store original wall specifications for rendering
        const wallSpecs = [];
        
        // Calculate wall specifications for rendering
        if (openSide !== 2) { // Bottom wall
            wallSpecs.push({ x: 0, y: boxSize / 2 - thickness / 2, width: boxSize, height: thickness });
        }
        if (openSide !== 0) { // Top wall
            wallSpecs.push({ x: 0, y: -boxSize / 2 + thickness / 2, width: boxSize, height: thickness });
        }
        if (openSide !== 3) { // Left wall
            wallSpecs.push({ x: -boxSize / 2 + thickness / 2, y: 0, width: thickness, height: boxSize });
        }
        if (openSide !== 1) { // Right wall
            wallSpecs.push({ x: boxSize / 2 - thickness / 2, y: 0, width: thickness, height: boxSize });
        }

        const box = {
            compoundBody: compoundBox,
            bodies: walls, // Keep reference for rendering
            wallSpecs: wallSpecs, // Store original wall positions for rendering
            color: color,
            x: x,
            y: y,
            width: boxSize,
            height: boxSize,
            openSide: openSide, // Store which side is open
            bounds: {
                minX: x - boxSize / 2,
                maxX: x + boxSize / 2,
                minY: y - boxSize / 2,
                maxY: y + boxSize / 2
            },
            isClosed: false, // Box has an opening
            topWall: null,
            containsBall: false,
            ballColor: null,
            isDynamic: false
        };
        
        World.add(this.world, compoundBox);
        return box;
    }
    
    closeBox(box) {
        if (box.isClosed) return;
        
        // Remove the compound body from the world
        World.remove(this.world, box.compoundBody);
        
        // Get the current position and angle from the compound body
        const currentX = box.compoundBody.position.x;
        const currentY = box.compoundBody.position.y;
        const currentAngle = box.compoundBody.angle;
        
        // Create a simple solid square body with the ball's color
        const solidSquare = Bodies.rectangle(currentX, currentY, box.width, box.height, {
            isStatic: this.ballsFixed,
            restitution: 0.4,
            friction: 0.5,
            frictionAir: 0.005,
            frictionStatic: 0.8,
            render: { fillStyle: box.ballColor }
        });
        
        // Set the angle to match the compound body's angle
        Body.setAngle(solidSquare, currentAngle);
        
        // Add some random initial angular velocity for rotation
        const randomAngularVelocity = (Math.random() - 0.5) * 0.3;
        Body.setAngularVelocity(solidSquare, randomAngularVelocity);
        
        // Add a small random initial velocity to encourage tumbling
        const randomVelocityX = (Math.random() - 0.5) * 2;
        const randomVelocityY = Math.random() * -1; // Slight upward velocity
        Body.setVelocity(solidSquare, { x: randomVelocityX, y: randomVelocityY });
        
        // Store the solid square body and mark as closed
        box.solidSquare = solidSquare;
        box.isClosed = true;
        box.isDynamic = true;
        box.compoundBody = null; // Clear the compound body reference
        
        // Add the solid square to the world
        World.add(this.world, solidSquare);
    }
    
    createBall(x, y, color, radius = 15) {
        const ball = Bodies.circle(x, y, radius, {
            isStatic: this.ballsFixed,
            restitution: 0.6,
            friction: 0.3,
            render: { fillStyle: color }
        });
        
        ball.ballColor = color;
        ball.isInCorrectBox = false;
        
        World.add(this.world, ball);
        return ball;
    }
    
    getRandomPosition(margin = 100) {
        return {
            x: margin + Math.random() * (this.width - margin * 2),
            y: margin + Math.random() * (this.height - margin * 2)
        };
    }
    
    getRandomBottomPosition(margin = 30) {
        const bottomArea = this.height * 0.2; // Bottom 20% of screen
        return {
            x: margin + Math.random() * (this.width - margin * 2),
            y: this.height - bottomArea + Math.random() * (bottomArea - margin)
        };
    }
    
    // Convert HSL to hex color
    hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
    
    // Calculate color distance in RGB space
    getColorDistance(color1, color2) {
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        
        const rDiff = rgb1.r - rgb2.r;
        const gDiff = rgb1.g - rgb2.g;
        const bDiff = rgb1.b - rgb2.b;
        
        return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
    }
    
    // Convert hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    // Darken a color by a given factor (0-1)
    darkenColor(hexColor, factor) {
        const rgb = this.hexToRgb(hexColor);
        if (!rgb) return hexColor;
        
        const r = Math.floor(rgb.r * (1 - factor));
        const g = Math.floor(rgb.g * (1 - factor));
        const b = Math.floor(rgb.b * (1 - factor));
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Generate N distinct random colors
    generateDistinctColors(count) {
        const colors = [];
        const minDistance = 120; // Minimum color distance for distinction
        const maxAttempts = 1000; // Prevent infinite loops
        
        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let newColor;
            let isDistinct = false;
            
            while (!isDistinct && attempts < maxAttempts) {
                // Generate random HSL color with good saturation and lightness
                const hue = Math.random() * 360;
                const saturation = 70 + Math.random() * 30; // 70-100% saturation
                const lightness = 45 + Math.random() * 25; // 45-70% lightness
                
                newColor = this.hslToHex(hue, saturation, lightness);
                
                // Check if this color is distinct from all existing colors
                isDistinct = colors.every(existingColor => 
                    this.getColorDistance(newColor, existingColor) >= minDistance
                );
                
                attempts++;
            }
            
            // If we couldn't find a distinct color, use a fallback
            if (!isDistinct) {
                // Use evenly spaced hues as fallback
                const hue = (i * 360 / count) % 360;
                newColor = this.hslToHex(hue, 80, 55);
            }
            
            colors.push(newColor);
        }
        
        return colors;
    }
    
    initializeGame() {
        console.log('Starting game...');
        this.clearGame();
        this.gameWon = false;
        const winScreen = document.getElementById('winScreen');
        if (winScreen) winScreen.style.display = 'none';
        
        this.boxes = [];
        this.balls = [];
        
        // Create matching pairs of boxes and balls
        const initialPairs = [
            this.gameColors[0], // Red
            this.gameColors[0], // Red (duplicate)
            this.gameColors[1], // Green
            this.gameColors[1], // Green (duplicate)
            this.gameColors[2], // Blue
            this.gameColors[3]  // Yellow
        ];
        
        // Create boxes
        for (let i = 0; i < initialPairs.length; i++) {
            let boxPos;
            let attempts = 0;
            
            do {
                boxPos = this.getRandomPosition(80);
                attempts++;
            } while (this.isPositionOccupied(boxPos, 100) && attempts < 50);
            
            const box = this.createSquareBox(boxPos.x, boxPos.y, initialPairs[i]);
            this.boxes.push(box);
            console.log('Created box at:', boxPos.x, boxPos.y, 'color:', initialPairs[i]);
        }
        
        // Create matching balls for each box
        for (let i = 0; i < initialPairs.length; i++) {
            let ballPos;
            let attempts = 0;
            
            do {
                ballPos = this.getRandomBottomPosition(30);
                attempts++;
            } while (this.isPositionOccupied(ballPos, 60) && attempts < 50);
            
            const ball = this.createBall(ballPos.x, ballPos.y, initialPairs[i]);
            this.balls.push(ball);
            console.log('Created ball at:', ballPos.x, ballPos.y, 'color:', initialPairs[i]);
        }
        
        console.log('Total boxes:', this.boxes.length, 'Total balls:', this.balls.length);
        this.updateUI();
        this.updateGravity(); // Initialize gravity
        
        // Start continuous ball spawning
        this.startBallSpawning();
    }
    
    drawGravityBackground() {
        // Calculate gradient direction based on gravity
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Gravity vector for gradient direction
        const gravityX = Math.cos(this.gravityAngle);
        const gravityY = Math.sin(this.gravityAngle);
        
        // Calculate gradient start and end points
        const gradientLength = Math.max(this.width, this.height);
        const startX = centerX - gravityX * gradientLength / 2;
        const startY = centerY - gravityY * gradientLength / 2;
        const endX = centerX + gravityX * gradientLength / 2;
        const endY = centerY + gravityY * gradientLength / 2;
        
        // Create linear gradient
        const gradient = this.ctx.createLinearGradient(startX, startY, endX, endY);
        
        // Use the debug gradient colors
        gradient.addColorStop(0, this.gradientColor1);
        gradient.addColorStop(0.5, this.gradientColor2);
        gradient.addColorStop(1, this.gradientColor3);
        
        // Fill the background
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    isPositionOccupied(pos, minDistance) {
        for (let box of this.boxes) {
            const distance = Math.sqrt(Math.pow(pos.x - box.x, 2) + Math.pow(pos.y - box.y, 2));
            if (distance < minDistance) return true;
        }
        
        for (let ball of this.balls) {
            const distance = Math.sqrt(Math.pow(pos.x - ball.position.x, 2) + Math.pow(pos.y - ball.position.y, 2));
            if (distance < minDistance) return true;
        }
        
        return false;
    }
    
    clearGame() {
        this.boxes.forEach(box => {
            if (box.compoundBody) {
                // Remove compound body for open boxes
                World.remove(this.world, box.compoundBody);
            } else if (box.solidSquare) {
                // Remove solid square for closed boxes
                World.remove(this.world, box.solidSquare);
            }
        });
        
        this.balls.forEach(ball => {
            World.remove(this.world, ball);
        });
        
        this.boxes = [];
        this.balls = [];
    }
    
    setupTouchControls() {
        // Touch start
        this.canvas.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.handleTouchStart(event);
        });
        
        // Touch move
        this.canvas.addEventListener('touchmove', (event) => {
            event.preventDefault();
            this.handleTouchMove(event);
        });
        
        // Touch end
        this.canvas.addEventListener('touchend', (event) => {
            event.preventDefault();
            this.handleTouchEnd(event);
        });
        
        // Mouse events for desktop testing
        this.canvas.addEventListener('mousedown', (event) => {
            this.handleMouseStart(event);
        });
        
        this.canvas.addEventListener('mousemove', (event) => {
            this.handleTouchMove(event);
        });
        
        this.canvas.addEventListener('mouseup', (event) => {
            this.handleTouchEnd(event);
        });
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        
        // Keyboard controls for testing
        window.addEventListener('keydown', (event) => {
            switch(event.key) {
                case 'ArrowLeft':
                    this.gravityAngle -= Math.PI / 12; // Rotate 15 degrees left
                    this.updateGravity();
                    break;
                case 'ArrowRight':
                    this.gravityAngle += Math.PI / 12; // Rotate 15 degrees right
                    this.updateGravity();
                    break;
            }
        });
    }
    
    handleMouseStart(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Check for double-click
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - this.lastClickTime;
        
        if (timeSinceLastClick < this.doubleClickDelay) {
            // Double-click detected - toggle fixed objects
            this.toggleFixedObjects();
            this.lastClickTime = 0; // Reset to prevent triple-click
            return; // Don't start dragging on double-click
        }
        
        this.lastClickTime = currentTime;
        
        // Allow dragging anywhere on screen
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartY = y;
        this.dragCurrentX = x;
        this.dragCurrentY = y;
    }
    
    handleTouchStart(event) {
        const rect = this.canvas.getBoundingClientRect();
        let x, y;
        
        if (event.touches && event.touches.length > 0) {
            x = event.touches[0].clientX - rect.left;
            y = event.touches[0].clientY - rect.top;
        } else {
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;
        }
        
        // Check for double-tap
        const currentTime = Date.now();
        const timeSinceLastTap = currentTime - this.lastTapTime;
        
        if (timeSinceLastTap < this.doubleTapDelay) {
            // Double-tap detected - toggle fixed objects
            this.toggleFixedObjects();
            this.lastTapTime = 0; // Reset to prevent triple-tap
            return; // Don't start dragging on double-tap
        }
        
        this.lastTapTime = currentTime;
        
        // Allow dragging anywhere on screen
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartY = y;
        this.dragCurrentX = x;
        this.dragCurrentY = y;
    }
    
    handleTouchMove(event) {
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        let x, y;
        
        if (event.touches && event.touches.length > 0) {
            x = event.touches[0].clientX - rect.left;
            y = event.touches[0].clientY - rect.top;
        } else {
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;
        }
        
        // Update current drag position
        this.dragCurrentX = x;
        this.dragCurrentY = y;
        
        // Calculate gravity direction from start to current position
        const deltaX = this.dragCurrentX - this.dragStartX;
        const deltaY = this.dragCurrentY - this.dragStartY;
        
        // Only update gravity if there's significant movement
        const minDistance = 10;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > minDistance) {
            // Calculate angle from start to current position
            this.gravityAngle = Math.atan2(deltaY, deltaX);
            
            // Keep angle between 0 and 2π
            this.gravityAngle = ((this.gravityAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
            
            // Calculate gravity strength based on drag distance
            const maxDistance = 100; // Maximum distance for full strength
            this.gravityStrength = Math.min(distance / maxDistance, 2) * this.baseGravityStrength;
            
            this.updateGravity();
        }
    }
    
    handleTouchEnd(event) {
        this.isDragging = false;
        // Reset gravity to base strength when not dragging
        this.gravityStrength = this.baseGravityStrength;
        this.updateGravity();
    }
    
    updateGravity() {
        // Convert angle to gravity vector
        const gravityX = Math.cos(this.gravityAngle) * this.gravityStrength;
        const gravityY = Math.sin(this.gravityAngle) * this.gravityStrength;
        
        this.engine.world.gravity.x = gravityX;
        this.engine.world.gravity.y = gravityY;
    }
    
    checkBallsInBoxes() {
        // Check remaining balls for placement
        this.balls.forEach(ball => {
            ball.isInCorrectBox = false;
            
            for (let box of this.boxes) {
                if (ball.ballColor === box.color && !box.containsBall) {
                    const ballX = ball.position.x;
                    const ballY = ball.position.y;
                    const ballRadius = ball.circleRadius;
                    
                    // Get current box bounds (either from original position or compound body position)
                    let boxCenterX, boxCenterY;
                    if (box.compoundBody) {
                        boxCenterX = box.compoundBody.position.x;
                        boxCenterY = box.compoundBody.position.y;
                    } else {
                        boxCenterX = box.x;
                        boxCenterY = box.y;
                    }
                    
                    // Calculate current box bounds
                    const currentBounds = {
                        minX: boxCenterX - box.width / 2,
                        maxX: boxCenterX + box.width / 2,
                        minY: boxCenterY - box.height / 2,
                        maxY: boxCenterY + box.height / 2
                    };
                    
                    // Check if ball is fully inside the open box (with radius consideration)
                    const margin = ballRadius + 5; // Extra margin to ensure ball is well inside
                    const isFullyInside = ballX >= currentBounds.minX + margin && 
                                         ballX <= currentBounds.maxX - margin &&
                                         ballY >= currentBounds.minY + margin && 
                                         ballY <= currentBounds.maxY - margin;
                    
                    if (isFullyInside) {
                        ball.isInCorrectBox = true;
                        
                        // Remove the ball from the world and array
                        World.remove(this.world, ball);
                        const ballIndex = this.balls.indexOf(ball);
                        if (ballIndex > -1) {
                            this.balls.splice(ballIndex, 1);
                        }
                        
                        // Mark box as containing the ball and store ball color
                        box.containsBall = true;
                        box.ballColor = ball.ballColor;
                        
                        // Close the box and make it dynamic
                        this.closeBox(box);
                        break;
                    }
                }
            }
        });
    }
    
    handleSquareCollision(boxA, boxB) {
        // Award points and remove both squares
        this.score += 10;
        
        // Remove both squares from the world
        World.remove(this.world, boxA.solidSquare);
        World.remove(this.world, boxB.solidSquare);
        
        // Mark boxes as destroyed to prevent rendering
        boxA.destroyed = true;
        boxB.destroyed = true;
        boxA.solidSquare = null;
        boxB.solidSquare = null;
        
        // Remove boxes from array (use filter to avoid index issues)
        this.boxes = this.boxes.filter(box => box !== boxA && box !== boxB);
        
        // Spawn new matching pair (box and ball with same color)
        this.spawnMatchingPair();
        
        console.log('Square collision! Score:', this.score);
    }
    
    spawnBox(color = null) {
        let boxPos;
        let attempts = 0;
        
        do {
            boxPos = this.getRandomPosition(80);
            attempts++;
        } while (this.isPositionOccupied(boxPos, 100) && attempts < 50);
        
        const boxColor = color || this.gameColors[Math.floor(Math.random() * this.gameColors.length)];
        const box = this.createSquareBox(boxPos.x, boxPos.y, boxColor);
        this.boxes.push(box);
        return boxColor;
    }
    
    // Removed spawnBalls method - no longer needed since we create exact pairs"
    
    spawnBall(color = null) {
        let ballPos;
        let attempts = 0;
        
        do {
            ballPos = this.getRandomBottomPosition(30);
            attempts++;
        } while (this.isPositionOccupied(ballPos, 60) && attempts < 50);
        
        const ballColor = color || this.gameColors[Math.floor(Math.random() * this.gameColors.length)];
        const ball = this.createBall(ballPos.x, ballPos.y, ballColor);
        this.balls.push(ball);
        return ballColor;
    }
    
    spawnMatchingPair() {
        // Choose a random color for the matching pair
        const pairColor = this.gameColors[Math.floor(Math.random() * this.gameColors.length)];
        
        // Spawn box and ball with matching color
        this.spawnBox(pairColor);
        this.spawnBall(pairColor);
    }
    
    startBallSpawning() {
        setInterval(() => {
            if (this.balls.length + this.boxes.length < 12) { // Keep reasonable total objects
                this.spawnMatchingPair();
            }
        }, 4000); // Spawn every 4 seconds
    }
    
    updateUI() {
        // Score display will be rendered in the render method
    }
    
    drawCenterGravityArrow() {
        this.ctx.save();
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const arrowLength = 100;
        const arrowHeadSize = 40;
        const shaftWidth = 20;
        const lineWidth = 3;
        
        // Calculate arrow direction
        const dirX = Math.cos(this.gravityAngle);
        const dirY = Math.sin(this.gravityAngle);
        
        // Calculate perpendicular direction for shaft width
        const perpX = -dirY;
        const perpY = dirX;
        
        // Calculate shaft end position
        const shaftEndX = centerX + dirX * (arrowLength - arrowHeadSize);
        const shaftEndY = centerY + dirY * (arrowLength - arrowHeadSize);
        
        // Calculate arrow tip
        const tipX = centerX + dirX * arrowLength;
        const tipY = centerY + dirY * arrowLength;
        
        // Set up drawing style - outline only with transparent fill
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillStyle = 'transparent';
        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Create fat arrow path
        this.ctx.beginPath();
        
        // Start at back left of shaft
        this.ctx.moveTo(
            centerX + perpX * shaftWidth / 2,
            centerY + perpY * shaftWidth / 2
        );
        
        // Go to front left of shaft
        this.ctx.lineTo(
            shaftEndX + perpX * shaftWidth / 2,
            shaftEndY + perpY * shaftWidth / 2
        );
        
        // Go to left side of arrow head
        this.ctx.lineTo(
            shaftEndX + perpX * arrowHeadSize / 2,
            shaftEndY + perpY * arrowHeadSize / 2
        );
        
        // Go to arrow tip
        this.ctx.lineTo(tipX, tipY);
        
        // Go to right side of arrow head
        this.ctx.lineTo(
            shaftEndX - perpX * arrowHeadSize / 2,
            shaftEndY - perpY * arrowHeadSize / 2
        );
        
        // Go to front right of shaft
        this.ctx.lineTo(
            shaftEndX - perpX * shaftWidth / 2,
            shaftEndY - perpY * shaftWidth / 2
        );
        
        // Go to back right of shaft
        this.ctx.lineTo(
            centerX - perpX * shaftWidth / 2,
            centerY - perpY * shaftWidth / 2
        );
        
        // Close the path
        this.ctx.closePath();
        
        // Draw outline only
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawGravityVector() {
        
        this.ctx.save();
        
        // Draw drag gesture if dragging
        if (this.isDragging) {
            const deltaX = this.dragCurrentX - this.dragStartX;
            const deltaY = this.dragCurrentY - this.dragStartY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance > 10) {
                // Draw drag line
                this.ctx.strokeStyle = '#FFFF00';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(this.dragStartX, this.dragStartY);
                this.ctx.lineTo(this.dragCurrentX, this.dragCurrentY);
                this.ctx.stroke();
                
                // Draw arrow head at current position
                const angle = Math.atan2(deltaY, deltaX);
                const headLen = 15;
                
                this.ctx.strokeStyle = '#FFFF00';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(this.dragCurrentX, this.dragCurrentY);
                this.ctx.lineTo(
                    this.dragCurrentX - headLen * Math.cos(angle - Math.PI / 6),
                    this.dragCurrentY - headLen * Math.sin(angle - Math.PI / 6)
                );
                this.ctx.moveTo(this.dragCurrentX, this.dragCurrentY);
                this.ctx.lineTo(
                    this.dragCurrentX - headLen * Math.cos(angle + Math.PI / 6),
                    this.dragCurrentY - headLen * Math.sin(angle + Math.PI / 6)
                );
                this.ctx.stroke();
                
                // Draw start point
                this.ctx.fillStyle = '#FFFF00';
                this.ctx.beginPath();
                this.ctx.arc(this.dragStartX, this.dragStartY, 5, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        }
        
        // Instruction text removed for cleaner UI
        
        this.ctx.restore();
    }
    
    gameLoop() {
        this.checkBallsInBoxes();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw gradient background following gravity direction
        this.drawGravityBackground();
        
        // Draw center gravity arrow in background
        // this.drawCenterGravityArrow();
        
        // Draw walls
        this.ctx.fillStyle = '#333';
        this.walls.forEach(wall => {
            const x = wall.position.x - (wall.bounds.max.x - wall.bounds.min.x) / 2;
            const y = wall.position.y - (wall.bounds.max.y - wall.bounds.min.y) / 2;
            const width = wall.bounds.max.x - wall.bounds.min.x;
            const height = wall.bounds.max.y - wall.bounds.min.y;
            
            this.ctx.fillRect(x, y, width, height);
        });
        
        // Draw boxes
        this.boxes.forEach(box => {
            // Skip destroyed boxes
            if (box.destroyed) return;
            
            if (box.containsBall && box.solidSquare) {
                // Draw the solid square for closed boxes (only if solidSquare exists)
                this.ctx.fillStyle = box.ballColor;
                this.ctx.strokeStyle = this.darkenColor(box.ballColor, 0.3);
                this.ctx.lineWidth = 2;
                
                // For dynamic solid squares, draw rotated filled square
                const bodyPos = box.solidSquare.position;
                const bodyAngle = box.solidSquare.angle;
                
                this.ctx.save();
                this.ctx.translate(bodyPos.x, bodyPos.y);
                this.ctx.rotate(bodyAngle);
                
                // Draw filled square with border
                this.ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
                this.ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
                
                this.ctx.restore();
            } else if (!box.containsBall) {
                // Draw gray box walls with colored corners for empty boxes
                this.ctx.fillStyle = '#666';
                
                // Draw individual wall bodies for boxes
                if (box.compoundBody && box.wallSpecs) {
                    // For compound bodies, use stored wall specifications for consistent rendering
                    this.ctx.save();
                    
                    const compoundX = box.compoundBody.position.x;
                    const compoundY = box.compoundBody.position.y;
                    const compoundAngle = box.compoundBody.angle;
                    
                    // Transform to the compound body's coordinate system
                    this.ctx.translate(compoundX, compoundY);
                    this.ctx.rotate(compoundAngle);
                    
                    // Draw each wall using the stored specifications
                    box.wallSpecs.forEach(wallSpec => {
                        this.ctx.fillRect(
                            wallSpec.x - wallSpec.width / 2,
                            wallSpec.y - wallSpec.height / 2,
                            wallSpec.width,
                            wallSpec.height
                        );
                    });
                    
                    this.ctx.restore();
                } else {
                    // Fallback for non-compound bodies
                    box.bodies.forEach(body => {
                        this.ctx.save();
                        
                        const bodyX = body.position.x;
                        const bodyY = body.position.y;
                        const bodyAngle = body.angle;
                        
                        const width = body.bounds.max.x - body.bounds.min.x;
                        const height = body.bounds.max.y - body.bounds.min.y;
                        
                        this.ctx.translate(bodyX, bodyY);
                        this.ctx.rotate(bodyAngle);
                        this.ctx.fillRect(-width / 2, -height / 2, width, height);
                        
                        this.ctx.restore();
                    });
                }
                
                // Draw colored corner indicators for empty boxes
                const cornerSize = 12;
                this.ctx.fillStyle = box.color;
                
                // Get box center position from compound body if available
                let boxCenterX, boxCenterY;
                if (box.compoundBody) {
                    boxCenterX = box.compoundBody.position.x;
                    boxCenterY = box.compoundBody.position.y;
                } else {
                    boxCenterX = box.x;
                    boxCenterY = box.y;
                }
                
                // Draw corners relative to the box center
                this.ctx.save();
                this.ctx.translate(boxCenterX, boxCenterY);
                if (box.compoundBody) {
                    this.ctx.rotate(box.compoundBody.angle);
                }
                
                // Top-left corner
                this.ctx.fillRect(
                    -box.width / 2, 
                    -box.height / 2, 
                    cornerSize, 
                    cornerSize
                );
                
                // Top-right corner
                this.ctx.fillRect(
                    box.width / 2 - cornerSize, 
                    -box.height / 2, 
                    cornerSize, 
                    cornerSize
                );
                
                // Bottom-left corner
                this.ctx.fillRect(
                    -box.width / 2, 
                    box.height / 2 - cornerSize, 
                    cornerSize, 
                    cornerSize
                );
                
                // Bottom-right corner
                this.ctx.fillRect(
                    box.width / 2 - cornerSize, 
                    box.height / 2 - cornerSize, 
                    cornerSize, 
                    cornerSize
                );
                
                this.ctx.restore();
            }
        });
        
        // Draw balls
        this.balls.forEach(ball => {
            this.ctx.fillStyle = ball.ballColor;
            this.ctx.strokeStyle = this.darkenColor(ball.ballColor, 0.3);
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(ball.position.x, ball.position.y, ball.circleRadius, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
        });
        
        // Draw gravity vector and UI
        this.drawGravityVector();
        
        // Draw score in top-left corner
        this.drawScore();
    }
    
    drawScore() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 40);
        this.ctx.restore();
    }
    
    toggleFixedObjects() {
        this.ballsFixed = !this.ballsFixed;
        
        // Apply the physics changes to existing objects
        this.balls.forEach(ball => {
            Body.setStatic(ball, this.ballsFixed);
        });
        
        this.boxes.forEach(box => {
            if (!box.isClosed && box.compoundBody) {
                // For open boxes, change the static state of the compound body
                Body.setStatic(box.compoundBody, !this.ballsFixed);
            } else if (box.solidSquare) {
                // For closed boxes, change the static state of the solid square
                Body.setStatic(box.solidSquare, this.ballsFixed);
            }
        });
    }
}

let game;

window.addEventListener('load', () => {
    game = new BallsInBoxesGame();
});

// Removed nextTurn function - game is now continuous

// Instructions removed for cleaner UI
// document.getElementById('instructions').innerHTML = 
//     'Draw the gravity direction: touch and drag to set gravity direction and move balls into matching colored boxes!';
