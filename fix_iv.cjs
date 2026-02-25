const fs = require('fs');
let c = fs.readFileSync('C:/Users/a/Documents/GitHub/viv/src/components/CenterPeak/ImageViewer.tsx', 'utf8');

// Remove Settings2 import
c = c.replace("import { MessageSquare, Settings2 } from 'lucide-react';\r\n", "import { MessageSquare } from 'lucide-react';\r\n");

// Remove ColorCorrectionPanel import
c = c.replace("import { ColorCorrectionPanel } from './ColorCorrectionPanel';\r\n", '');

// Add colorCorrection prop to SketchTools - find the SketchTools JSX block
// First check what it looks like
const sketchIdx = c.indexOf('<SketchTools');
const sketchSnippet = c.slice(sketchIdx, sketchIdx + 400);
console.log('SketchTools snippet:', JSON.stringify(sketchSnippet));

fs.writeFileSync('C:/Users/a/Documents/GitHub/viv/src/components/CenterPeak/ImageViewer.tsx', c);
console.log('Done phase1');
