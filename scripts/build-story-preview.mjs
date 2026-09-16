// Builds a no-network, self-contained review fragment. No deployment or repository mutation.
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const output = process.argv[2] || 'story-preview.html';
const result = await build({
  entryPoints:['src/app/prototype.tsx'], bundle:true, minify:true, format:'iife', write:false,
  outfile:'preview.js', jsx:'automatic', define:{'process.env.NODE_ENV':'"production"'},
  plugins:[{name:'inline-existing-node',setup(b){
    b.onLoad({filter:/NodeWaveHero\.tsx$/},async({path})=>{
      let contents=await readFile(path,'utf8');
      contents=contents.replace('import nodeWireUrl from "../assets/node_wire.bin?url";', 'import { nodeBuffer } from "./methodology/nodeGeometry.js";');
      contents=contents.replace(/fetch\(nodeWireUrl\)\s*\.then\(\(r\) => r.arrayBuffer\(\)\)/,'Promise.resolve(nodeBuffer())');
      return {contents,loader:'tsx'};
    });
  }}],
});
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
if(/\bfetch\(/.test(js)) throw new Error('The review preview must not make network requests.');
const shell=await readFile('scripts/story-preview-shell.html','utf8');
await writeFile(output,shell.replace('/* BUNDLED_CSS */',css).replace('/* BUNDLED_JS */',()=>js.replaceAll('</script','<\\/script')));
console.log(`Review fragment: ${output} (${(Buffer.byteLength(js)+Buffer.byteLength(css))/1024|0} kB)`);
