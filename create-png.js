const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a canvas
const canvas = createCanvas(128, 128);
const ctx = canvas.getContext('2d');

// Draw a dark background
ctx.fillStyle = '#1e1e1e';
ctx.beginPath();
ctx.roundRect(0, 0, 128, 128, 14);
ctx.fill();

// Draw the text
ctx.fillStyle = '#ffffff';
ctx.font = 'italic 60px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('g()', 64, 70);

// Save as PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('resources/gfactor-icon.png', buffer);

console.log('PNG icon created successfully!');