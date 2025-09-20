import { describe, expect, it } from 'vitest';
import { occupancy } from '../hooks/useInventory';

function makeImageData(w:number,h:number, fill:[number,number,number]){
  const data = new Uint8ClampedArray(w*h*4);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const i=(y*w+x)*4; data[i]=fill[0]; data[i+1]=fill[1]; data[i+2]=fill[2]; data[i+3]=255;
  }
  return new ImageData(data,w,h);
}

describe('occupancy', ()=>{
  it('returns 0 for identical frames', ()=>{
    const a = makeImageData(10,10,[10,10,10]);
    const b = makeImageData(10,10,[10,10,10]);
    const v = occupancy(a,b,{x:0,y:0,w:10,h:10},1,5);
    expect(v).toBe(0);
  });
  it('detects difference', ()=>{
    const a = makeImageData(10,10,[10,10,10]);
    const b = makeImageData(10,10,[240,240,240]);
    const v = occupancy(a,b,{x:0,y:0,w:10,h:10},1,5);
    expect(v).toBeGreaterThan(0.9);
  });
});
