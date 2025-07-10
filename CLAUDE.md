# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a physics-based puzzle game called "Balls in the Boxes" built with HTML5 Canvas and Matter.js physics engine. The game challenges players to manipulate gravity to move colored balls into matching colored boxes.

## Architecture

The game consists of two main files:

- **index.html**: The main HTML file that sets up the game UI, canvas, and includes the physics engine
- **game.js**: Contains the main game logic in the `BallsInBoxesGame` class

### Key Components

**BallsInBoxesGame Class** (`game.js`):
- **Physics Engine**: Uses Matter.js for realistic physics simulation
- **Game Objects**: Manages balls, boxes, and walls with collision detection
- **Input System**: Handles touch/mouse controls for gravity manipulation
- **Rendering**: Custom canvas rendering with gradient backgrounds
- **Game Logic**: Win condition checking, box closing mechanics, and turn progression

**Game Mechanics**:
- Players drag on screen to set gravity direction and strength
- Balls must be placed in matching colored boxes to win
- Boxes close and become dynamic physics objects when they contain the correct ball
- Each turn generates 4 random colored balls and boxes

## Development

### Running the Game

Open `index.html` in a web browser. The game uses:
- Matter.js physics engine (loaded via CDN)
- HTML5 Canvas for rendering
- Touch/mouse controls for gravity manipulation

### No Build Process

This is a simple HTML/JavaScript project with no build tools, package managers, or testing frameworks. Changes can be tested by refreshing the browser.

### Key Files to Modify

- `game.js:BallsInBoxesGame` - Main game class containing all logic
- `index.html` - UI structure and styling
- Physics constants at `game.js:60-64` for gravity settings
- Game parameters like colors at `game.js:21` and object counts at `game.js:265`

### Touch/Mouse Controls

The game supports both touch (mobile) and mouse (desktop) input:
- Touch/drag anywhere to set gravity direction and strength
- Arrow keys for testing gravity rotation
- Gravity strength scales with drag distance

### Canvas Rendering

Custom rendering system in `render()` method handles:
- Gradient background that follows gravity direction
- Static/dynamic box rendering based on state
- Ball physics visualization
- UI overlays for score and turn information