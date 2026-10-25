---------------------------- MODULE NotesPersistence ----------------------------
(***************************************************************************)
(* Reading-note persistence in local-app/server.mjs (createStudio).        *)
(*                                                                         *)
(* Code map (each action is one run of JavaScript between two awaits):     *)
(*   mem    : `state.items` held in memory, served by GET /api/state.      *)
(*   disk   : the file `<dataDir>/<index.id>.json`, read once at startup.  *)
(*   queue  : links of the `writes` promise chain, each with the JSON      *)
(*            snapshot that `save()` serialised when it was called.        *)
(*   broken : TRUE once a link rejected; `writes` then stays rejected, so  *)
(*            every later `writes.then(...)` rejects without running.      *)
(*   Add(i)    : POST /api/item (and /api/explain) after `await source()`: *)
(*               push the item, call save(), await it.                     *)
(*   Delete(i) : POST /api/delete: filter `state.items`, call save().      *)
(*   Write     : one link of the chain: writeFile(tmp) then rename(tmp).   *)
(*               Both are folded into one step: rename is atomic and the   *)
(*               tmp file is never read, so either await failing rejects   *)
(*               the link the same way.                                    *)
(*   Restart   : the process stops and createStudio reloads `disk`.        *)
(* Serialized = FALSE models a broken variant in which save() starts each  *)
(* write at once instead of chaining it, so writes finish in any order.    *)
(***************************************************************************)
EXTENDS Naturals, Sequences

CONSTANTS Items, DeleteItems, MaxFailures, MaxRestarts, Serialized

ASSUME DeleteItems \subseteq Items

Requests == {<<"add", i>> : i \in Items} \cup {<<"del", i>> : i \in DeleteItems}

\* idle: not sent yet; waiting: awaiting save(); acked: 200;
\* failed: 400 after its own write failed; skipped: 400 without its write being attempted;
\* dropped: lost in a restart before an answer.
Status == {"idle", "waiting", "acked", "failed", "skipped", "dropped"}

VARIABLES mem, disk, queue, broken, pc, failures, restarts
vars == <<mem, disk, queue, broken, pc, failures, restarts>>

Init ==
  /\ mem = {}
  /\ disk = {}
  /\ queue = <<>>
  /\ broken = FALSE
  /\ pc = [r \in Requests |-> "idle"]
  /\ failures = 0
  /\ restarts = 0

Enqueue(snapshot, r) == queue' = Append(queue, [snap |-> snapshot, req |-> r])

Add(i) ==
  /\ pc[<<"add", i>>] = "idle"
  /\ mem' = mem \cup {i}
  /\ Enqueue(mem \cup {i}, <<"add", i>>)
  /\ pc' = [pc EXCEPT ![<<"add", i>>] = "waiting"]
  /\ UNCHANGED <<disk, broken, failures, restarts>>

\* The notes view only offers 削除 for an item it lists.
Delete(i) ==
  /\ pc[<<"del", i>>] = "idle"
  /\ i \in mem
  /\ mem' = mem \ {i}
  /\ Enqueue(mem \ {i}, <<"del", i>>)
  /\ pc' = [pc EXCEPT ![<<"del", i>>] = "waiting"]
  /\ UNCHANGED <<disk, broken, failures, restarts>>

Remove(k) == [j \in 1..(Len(queue) - 1) |-> IF j < k THEN queue[j] ELSE queue[j + 1]]

\* Serialized: only the head link runs. Unserialized: any pending write may finish next.
Runnable == IF Serialized THEN (IF queue = <<>> THEN {} ELSE {1}) ELSE 1..Len(queue)

WriteOk(k) ==
  /\ ~(Serialized /\ broken)
  /\ disk' = queue[k].snap
  /\ pc' = [pc EXCEPT ![queue[k].req] = "acked"]
  /\ queue' = Remove(k)
  /\ UNCHANGED <<mem, broken, failures, restarts>>

WriteFails(k) ==
  /\ ~(Serialized /\ broken)
  /\ failures < MaxFailures
  /\ failures' = failures + 1
  /\ broken' = Serialized
  /\ pc' = [pc EXCEPT ![queue[k].req] = "failed"]
  /\ queue' = Remove(k)
  /\ UNCHANGED <<mem, disk, restarts>>

\* `writes.then(fn)` on a rejected `writes`: fn never runs, the caller gets the old rejection.
WriteSkipped(k) ==
  /\ Serialized /\ broken
  /\ pc' = [pc EXCEPT ![queue[k].req] = "skipped"]
  /\ queue' = Remove(k)
  /\ UNCHANGED <<mem, disk, broken, failures, restarts>>

Write == \E k \in Runnable : WriteOk(k) \/ WriteFails(k) \/ WriteSkipped(k)

Restart ==
  /\ restarts < MaxRestarts
  /\ restarts' = restarts + 1
  /\ mem' = disk
  /\ queue' = <<>>
  /\ broken' = FALSE
  /\ pc' = [r \in Requests |-> IF pc[r] = "waiting" THEN "dropped" ELSE pc[r]]
  /\ UNCHANGED <<disk, failures>>

Next ==
  \/ \E i \in Items : Add(i)
  \/ \E i \in DeleteItems : Delete(i)
  \/ Write
  \/ Restart

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
TypeOK ==
  /\ mem \subseteq Items /\ disk \subseteq Items
  /\ pc \in [Requests -> Status]
  /\ broken \in BOOLEAN

DeleteStarted(i) == i \in DeleteItems /\ pc[<<"del", i>>] # "idle"

\* A note answered with 200 is in the file until someone starts deleting it.
AckedSurvives == \A i \in Items : pc[<<"add", i>>] = "acked" /\ ~DeleteStarted(i) => i \in disk

\* A delete answered with 200 is not undone by an older write.
AckedDeleteSticks == \A i \in DeleteItems : pc[<<"del", i>>] = "acked" => i \notin disk

\* With no write pending, the notebook the server shows is what a restart loads.
IdleMatchesDisk == queue = <<>> => mem = disk

\* A save fails only if its own write failed, never because an earlier one did.
NoSkippedSave == \A r \in Requests : pc[r] # "skipped"
=============================================================================
