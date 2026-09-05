export const ru8=(b,o)=>b[o];
export const ru16=(b,o)=>b[o]|b[o+1]<<8;
export const ru32=(b,o)=>(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;
