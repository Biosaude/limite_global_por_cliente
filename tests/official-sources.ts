// Exact file identities for the original and the corrected attachment supplied by the owner.
const sources:Record<string,{daysMismatch:number}>={
 '4632fc2006fe6e0dd9c5ea33e7f0abb77f1737da88900233e3c5f4b76d00107b':{daysMismatch:17},
 '95c06103c0102d71d1aae3f40cad83ba721de7ac0f32f435d077ec934be554d1':{daysMismatch:2348},
};
export function officialExpectation(sha256:string){const result=sources[sha256];if(!result)throw Error('Unrecognized official test source: audit the file before updating expectations.');return result;}
