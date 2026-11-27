// Guards for progress writes. Cloudflare KV is eventually consistent across PoPs, so a
// later read can return a pre-write snapshot. If the snapshot is behind the client's rev,
// or the posted itemId is not S.current.id, the worker must not grade and must not KV.put.
// Missing itemId / rev stays allowed so older clients and first-load sessions still work.

export const STALE_JANE='Hang on, that answer was a moment behind. Try it once more? 🔄';
export const MISMATCH_JANE='This question already moved on! Here is the one on your screen. 🙌';

export function writeGuard(S,req={}){
  const want=req.rev??req.minRev;
  if(want!=null&&Number.isFinite(+want)&&(S?.rev||0)<+want)
    return {stale:true,jane:STALE_JANE};
  const id=req.itemId;
  if(id!=null&&id!==''&&!S?.current)return {mismatch:true,jane:MISMATCH_JANE};
  if(id!=null&&id!==''&&S?.current?.id&&String(id)!==String(S.current.id))
    return {mismatch:true,jane:MISMATCH_JANE};
  return null;
}

// True when this request must not persist the in-memory record (a stale snapshot or a mismatch).
export function mustNotPersist(guard){return !!(guard&&(guard.stale||guard.mismatch));}
