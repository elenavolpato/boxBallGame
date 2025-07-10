const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
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
        this.turn = 1;
        this.gameWon = false;
        
        this.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
        this.balls = [];
        this.boxes = [];
        this.walls = [];
        
        this.gravityAngle = Math.PI / 2; // Start pointing down
        this.baseGravityStrength = 1;
        this.gravityStrength = 1;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragCurrentX = 0;
        this.dragCurrentY = 0;
        
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
        this.gameLoop();
        this.newTurn();
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
    
    createWalls() {
        const thickness = 20;
        
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
    
    createSquareBox(x, y, color, boxSize = 70) {
        const thickness = 6;
        
        // Randomly select which side to leave open (0=top, 1=right, 2=bottom, 3=left)
        const openSide = Math.floor(Math.random() * 4);
        
        const walls = [];
        
        // Create walls based on which side is open
        if (openSide !== 2) { // Bottom wall (unless bottom is open)
            walls.push(Bodies.rectangle(x, y + boxSize / 2 - thickness / 2, boxSize, thickness, {
                isStatic: true,
                render: { fillStyle: '#666' }
            }));
        }
        
        if (openSide !== 0) { // Top wall (unless top is open)
            walls.push(Bodies.rectangle(x, y - boxSize / 2 + thickness / 2, boxSize, thickness, {
                isStatic: true,
                render: { fillStyle: '#666' }
            }));
        }
        
        if (openSide !== 3) { // Left wall (unless left is open)
            walls.push(Bodies.rectangle(x - boxSize / 2 + thickness / 2, y, thickness, boxSize, {
                isStatic: true,
                render: { fillStyle: '#666' }
            }));
        }
        
        if (openSide !== 1) { // Right wall (unless right is open)
            walls.push(Bodies.rectangle(x + boxSize / 2 - thickness / 2, y, thickness, boxSize, {
                isStatic: true,
                render: { fillStyle: '#666' }
            }));
        }
        
        const box = {
            bodies: walls,
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
            ballColor: null
        };
        
        World.add(this.world, walls);
        return box;
    }
    
    closeBox(box) {
        if (box.isClosed) return;
        
        // Create wall to close the open side
        const thickness = 6;
        let closingWall;
        
        switch (box.openSide) {
            case 0: // Top was open
                closingWall = Bodies.rectangle(box.x, box.y - box.height / 2 + thickness / 2, box.width, thickness, {
                    isStatic: true,
                    render: { fillStyle: '#666' }
                });
                break;
            case 1: // Right was open
                closingWall = Bodies.rectangle(box.x + box.width / 2 - thickness / 2, box.y, thickness, box.height, {
                    isStatic: true,
                    render: { fillStyle: '#666' }
                });
                break;
            case 2: // Bottom was open
                closingWall = Bodies.rectangle(box.x, box.y + box.height / 2 - thickness / 2, box.width, thickness, {
                    isStatic: true,
                    render: { fillStyle: '#666' }
                });
                break;
            case 3: // Left was open
                closingWall = Bodies.rectangle(box.x - box.width / 2 + thickness / 2, box.y, thickness, box.height, {
                    isStatic: true,
                    render: { fillStyle: '#666' }
                });
                break;
        }
        
        box.closingWall = closingWall;
        box.bodies.push(closingWall);
        box.isClosed = true;
        
        World.add(this.world, closingWall);
        
        // Remove individual wall bodies from the world
        World.remove(this.world, box.bodies);
        
        // Create a single compound body from all the walls
        const compoundBody = Body.create({
            parts: box.bodies,
            isStatic: false,
            restitution: 0.4,
            friction: 0.5,
            frictionAir: 0.005,
            frictionStatic: 0.8
        });
        
        // Add some random initial angular velocity for rotation
        const randomAngularVelocity = (Math.random() - 0.5) * 0.3;
        Body.setAngularVelocity(compoundBody, randomAngularVelocity);
        
        // Add a small random initial velocity to encourage tumbling
        const randomVelocityX = (Math.random() - 0.5) * 2;
        const randomVelocityY = Math.random() * -1; // Slight upward velocity
        Body.setVelocity(compoundBody, { x: randomVelocityX, y: randomVelocityY });
        
        // Store the compound body
        box.compoundBody = compoundBody;
        box.isDynamic = true;
        
        // Add the compound body to the world
        World.add(this.world, compoundBody);
    }
    
    createBall(x, y, color, radius = 15) {
        const ball = Bodies.circle(x, y, radius, {
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
    
    newTurn() {
        console.log('Starting new turn...');
        this.clearGame();
        this.gameWon = false;
        const winScreen = document.getElementById('winScreen');
        if (winScreen) winScreen.style.display = 'none';
        
        const shuffledColors = [...this.colors].sort(() => Math.random() - 0.5);
        console.log('Colors:', shuffledColors);
        
        this.boxes = [];
        this.balls = [];
        
        for (let i = 0; i < 4; i++) {
            let boxPos, ballPos;
            let attempts = 0;
            
            do {
                boxPos = this.getRandomPosition(80);
                attempts++;
            } while (this.isPositionOccupied(boxPos, 100) && attempts < 50);
            
            const box = this.createSquareBox(boxPos.x, boxPos.y, shuffledColors[i]);
            this.boxes.push(box);
            console.log('Created box at:', boxPos.x, boxPos.y, 'color:', shuffledColors[i]);
            
            attempts = 0;
            do {
                ballPos = this.getRandomBottomPosition(30);
                attempts++;
            } while (this.isPositionOccupied(ballPos, 60) && attempts < 50);
            
            const ball = this.createBall(ballPos.x, ballPos.y, shuffledColors[i]);
            this.balls.push(ball);
            console.log('Created ball at:', ballPos.x, ballPos.y, 'color:', shuffledColors[i]);
        }
        
        console.log('Total boxes:', this.boxes.length, 'Total balls:', this.balls.length);
        this.updateUI();
        this.updateGravity(); // Initialize gravity
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
        
        // Darker but still light colors for the gradient
        gradient.addColorStop(0, '#d0e0f0'); // Darker light blue
        gradient.addColorStop(0.5, '#c5d9ec'); // Medium light blue
        gradient.addColorStop(1, '#b8d0e8'); // Slightly darker blue
        
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
            if (box.isDynamic && box.compoundBody) {
                // Remove compound body for dynamic boxes
                World.remove(this.world, box.compoundBody);
            } else {
                // Remove individual bodies for static boxes
                World.remove(this.world, box.bodies);
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
            this.handleTouchStart(event);
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
    
    checkWinCondition() {
        if (this.gameWon) return;
        
        let correctBalls = 0;
        
        // First, check how many boxes contain balls
        this.boxes.forEach(box => {
            if (box.containsBall) {
                correctBalls++;
            }
        });
        
        // Then check remaining balls for placement
        this.balls.forEach(ball => {
            ball.isInCorrectBox = false;
            
            for (let box of this.boxes) {
                if (ball.ballColor === box.color && !box.containsBall) {
                    const ballX = ball.position.x;
                    const ballY = ball.position.y;
                    const ballRadius = ball.circleRadius;
                    
                    // Check if ball is fully inside the open box (with radius consideration)
                    const margin = ballRadius + 5; // Extra margin to ensure ball is well inside
                    const isFullyInside = ballX >= box.bounds.minX + margin && 
                                         ballX <= box.bounds.maxX - margin &&
                                         ballY >= box.bounds.minY + margin && 
                                         ballY <= box.bounds.maxY - margin;
                    
                    if (isFullyInside) {
                        ball.isInCorrectBox = true;
                        correctBalls++;
                        
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
        
        if (correctBalls === 4) {
            this.gameWon = true;
            this.score += 100;
            this.updateUI();
            setTimeout(() => {
                document.getElementById('winScreen').style.display = 'block';
            }, 500);
        }
    }
    
    updateUI() {
        document.getElementById('score').textContent = `Score: ${this.score}`;
        document.getElementById('turn').textContent = `Turn: ${this.turn}`;
    }
    
    drawGravityVector() {
        // Comment out gravity vector for cleaner UI
        /*
        const centerX = this.width / 2;
        const centerY = 50;
        const scale = 50;
        
        // Clear previous vector
        this.ctx.save();
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        this.ctx.fillStyle = '#FF0000';
        
        // Draw gravity vector
        const gravityX = this.engine.world.gravity.x * scale;
        const gravityY = this.engine.world.gravity.y * scale;
        
        // Arrow line
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.lineTo(centerX + gravityX, centerY + gravityY);
        this.ctx.stroke();
        
        // Arrow head
        const angle = Math.atan2(gravityY, gravityX);
        const headLen = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + gravityX, centerY + gravityY);
        this.ctx.lineTo(centerX + gravityX - headLen * Math.cos(angle - Math.PI / 6), 
                        centerY + gravityY - headLen * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(centerX + gravityX, centerY + gravityY);
        this.ctx.lineTo(centerX + gravityX - headLen * Math.cos(angle + Math.PI / 6), 
                        centerY + gravityY - headLen * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();
        */
        
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
        this.checkWinCondition();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw gradient background following gravity direction
        this.drawGravityBackground();
        
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
            if (box.containsBall) {
                // Draw filled colored square for boxes with balls
                this.ctx.fillStyle = box.ballColor;
                
                if (box.isDynamic && box.compoundBody) {
                    // For dynamic boxes, draw rotated filled square
                    const bodyPos = box.compoundBody.position;
                    const bodyAngle = box.compoundBody.angle;
                    
                    this.ctx.save();
                    this.ctx.translate(bodyPos.x, bodyPos.y);
                    this.ctx.rotate(bodyAngle);
                    
                    // Draw filled square
                    this.ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
                    
                    this.ctx.restore();
                } else {
                    // For static boxes, draw filled square at original position
                    this.ctx.fillRect(
                        box.x - box.width / 2, 
                        box.y - box.height / 2, 
                        box.width, 
                        box.height
                    );
                }
            } else {
                // Draw gray box walls with colored corners for empty boxes
                this.ctx.fillStyle = '#666';
                
                if (box.isDynamic && box.compoundBody) {
                    // For dynamic boxes (shouldn't happen for empty boxes, but just in case)
                    const bodyPos = box.compoundBody.position;
                    const bodyAngle = box.compoundBody.angle;
                    
                    this.ctx.save();
                    this.ctx.translate(bodyPos.x, bodyPos.y);
                    this.ctx.rotate(bodyAngle);
                    
                    // Draw walls
                    const thickness = 6;
                    this.ctx.fillRect(-box.width / 2, box.height / 2 - thickness, box.width, thickness);
                    this.ctx.fillRect(-box.width / 2, -box.height / 2, box.width, thickness);
                    this.ctx.fillRect(-box.width / 2, -box.height / 2, thickness, box.height);
                    this.ctx.fillRect(box.width / 2 - thickness, -box.height / 2, thickness, box.height);
                    
                    this.ctx.restore();
                } else {
                    // For static boxes, draw individual wall bodies
                    box.bodies.forEach(body => {
                        const x = body.position.x - (body.bounds.max.x - body.bounds.min.x) / 2;
                        const y = body.position.y - (body.bounds.max.y - body.bounds.min.y) / 2;
                        const width = body.bounds.max.x - body.bounds.min.x;
                        const height = body.bounds.max.y - body.bounds.min.y;
                        
                        this.ctx.fillRect(x, y, width, height);
                    });
                }
                
                // Draw colored corner indicators for empty boxes
                const cornerSize = 12;
                this.ctx.fillStyle = box.color;
                
                // Top-left corner
                this.ctx.fillRect(
                    box.x - box.width / 2, 
                    box.y - box.height / 2, 
                    cornerSize, 
                    cornerSize
                );
                
                // Top-right corner
                this.ctx.fillRect(
                    box.x + box.width / 2 - cornerSize, 
                    box.y - box.height / 2, 
                    cornerSize, 
                    cornerSize
                );
                
                // Bottom-left corner
                this.ctx.fillRect(
                    box.x - box.width / 2, 
                    box.y + box.height / 2 - cornerSize, 
                    cornerSize, 
                    cornerSize
                );
                
                // Bottom-right corner
                this.ctx.fillRect(
                    box.x + box.width / 2 - cornerSize, 
                    box.y + box.height / 2 - cornerSize, 
                    cornerSize, 
                    cornerSize
                );
            }
        });
        
        // Draw balls
        this.balls.forEach(ball => {
            this.ctx.fillStyle = ball.ballColor;
            this.ctx.beginPath();
            this.ctx.arc(ball.position.x, ball.position.y, ball.circleRadius, 0, 2 * Math.PI);
            this.ctx.fill();
        });
        
        // Draw gravity vector and UI
        this.drawGravityVector();
    }
    
    nextTurn() {
        this.turn++;
        this.newTurn();
    }
}

let game;

window.addEventListener('load', () => {
    game = new BallsInBoxesGame();
});

function nextTurn() {
    game.nextTurn();
}

// Instructions removed for cleaner UI
// document.getElementById('instructions').innerHTML = 
//     'Draw the gravity direction: touch and drag to set gravity direction and move balls into matching colored boxes!';
