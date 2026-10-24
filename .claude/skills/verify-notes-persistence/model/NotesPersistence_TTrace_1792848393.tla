---- MODULE NotesPersistence_TTrace_1792848393 ----
EXTENDS NotesPersistence_TEConstants, Sequences, TLCExt, Toolbox, Naturals, TLC, NotesPersistence

_expression ==
    LET NotesPersistence_TEExpression == INSTANCE NotesPersistence_TEExpression
    IN NotesPersistence_TEExpression!expression
----

_trace ==
    LET NotesPersistence_TETrace == INSTANCE NotesPersistence_TETrace
    IN NotesPersistence_TETrace!trace
----

_inv ==
    ~(
        TLCGet("level") = Len(_TETrace)
        /\
        broken = (FALSE)
        /\
        disk = ({a})
        /\
        failures = (0)
        /\
        pc = ((<<"add", a>> :> "acked" @@ <<"add", b>> :> "idle" @@ <<"add", c>> :> "acked" @@ <<"del", a>> :> "idle" @@ <<"del", b>> :> "idle"))
        /\
        mem = ({a, c})
        /\
        restarts = (0)
        /\
        queue = (<<>>)
    )
----

_init ==
    /\ restarts = _TETrace[1].restarts
    /\ failures = _TETrace[1].failures
    /\ mem = _TETrace[1].mem
    /\ broken = _TETrace[1].broken
    /\ pc = _TETrace[1].pc
    /\ disk = _TETrace[1].disk
    /\ queue = _TETrace[1].queue
----

_next ==
    /\ \E i,j \in DOMAIN _TETrace:
        /\ \/ /\ j = i + 1
              /\ i = TLCGet("level")
        /\ restarts  = _TETrace[i].restarts
        /\ restarts' = _TETrace[j].restarts
        /\ failures  = _TETrace[i].failures
        /\ failures' = _TETrace[j].failures
        /\ mem  = _TETrace[i].mem
        /\ mem' = _TETrace[j].mem
        /\ broken  = _TETrace[i].broken
        /\ broken' = _TETrace[j].broken
        /\ pc  = _TETrace[i].pc
        /\ pc' = _TETrace[j].pc
        /\ disk  = _TETrace[i].disk
        /\ disk' = _TETrace[j].disk
        /\ queue  = _TETrace[i].queue
        /\ queue' = _TETrace[j].queue

\* Uncomment the ASSUME below to write the states of the error trace
\* to the given file in Json format. Note that you can pass any tuple
\* to `JsonSerialize`. For example, a sub-sequence of _TETrace.
    \* ASSUME
    \*     LET J == INSTANCE Json
    \*         IN J!JsonSerialize("NotesPersistence_TTrace_1792848393.json", _TETrace)

=============================================================================

 Note that you can extract this module `NotesPersistence_TEExpression`
  to a dedicated file to reuse `expression` (the module in the 
  dedicated `NotesPersistence_TEExpression.tla` file takes precedence 
  over the module `NotesPersistence_TEExpression` below).

---- MODULE NotesPersistence_TEExpression ----
EXTENDS NotesPersistence_TEConstants, Sequences, TLCExt, Toolbox, Naturals, TLC, NotesPersistence

expression == 
    [
        \* To hide variables of the `NotesPersistence` spec from the error trace,
        \* remove the variables below.  The trace will be written in the order
        \* of the fields of this record.
        restarts |-> restarts
        ,failures |-> failures
        ,mem |-> mem
        ,broken |-> broken
        ,pc |-> pc
        ,disk |-> disk
        ,queue |-> queue
        
        \* Put additional constant-, state-, and action-level expressions here:
        \* ,_stateNumber |-> _TEPosition
        \* ,_restartsUnchanged |-> restarts = restarts'
        
        \* Format the `restarts` variable as Json value.
        \* ,_restartsJson |->
        \*     LET J == INSTANCE Json
        \*     IN J!ToJson(restarts)
        
        \* Lastly, you may build expressions over arbitrary sets of states by
        \* leveraging the _TETrace operator.  For example, this is how to
        \* count the number of times a spec variable changed up to the current
        \* state in the trace.
        \* ,_restartsModCount |->
        \*     LET F[s \in DOMAIN _TETrace] ==
        \*         IF s = 1 THEN 0
        \*         ELSE IF _TETrace[s].restarts # _TETrace[s-1].restarts
        \*             THEN 1 + F[s-1] ELSE F[s-1]
        \*     IN F[_TEPosition - 1]
    ]

=============================================================================



Parsing and semantic processing can take forever if the trace below is long.
 In this case, it is advised to uncomment the module below to deserialize the
 trace from a generated binary file.

\*
\*---- MODULE NotesPersistence_TETrace ----
\*EXTENDS NotesPersistence_TEConstants, IOUtils, TLC, NotesPersistence
\*
\*trace == IODeserialize("NotesPersistence_TTrace_1792848393.bin", TRUE)
\*
\*=============================================================================
\*

---- MODULE NotesPersistence_TETrace ----
EXTENDS NotesPersistence_TEConstants, TLC, NotesPersistence

trace == 
    <<
    ([broken |-> FALSE,disk |-> {},failures |-> 0,pc |-> (<<"add", a>> :> "idle" @@ <<"add", b>> :> "idle" @@ <<"add", c>> :> "idle" @@ <<"del", a>> :> "idle" @@ <<"del", b>> :> "idle"),mem |-> {},restarts |-> 0,queue |-> <<>>]),
    ([broken |-> FALSE,disk |-> {},failures |-> 0,pc |-> (<<"add", a>> :> "waiting" @@ <<"add", b>> :> "idle" @@ <<"add", c>> :> "idle" @@ <<"del", a>> :> "idle" @@ <<"del", b>> :> "idle"),mem |-> {a},restarts |-> 0,queue |-> <<[snap |-> {a}, req |-> <<"add", a>>]>>]),
    ([broken |-> FALSE,disk |-> {},failures |-> 0,pc |-> (<<"add", a>> :> "waiting" @@ <<"add", b>> :> "idle" @@ <<"add", c>> :> "waiting" @@ <<"del", a>> :> "idle" @@ <<"del", b>> :> "idle"),mem |-> {a, c},restarts |-> 0,queue |-> <<[snap |-> {a}, req |-> <<"add", a>>], [snap |-> {a, c}, req |-> <<"add", c>>]>>]),
    ([broken |-> FALSE,disk |-> {a, c},failures |-> 0,pc |-> (<<"add", a>> :> "waiting" @@ <<"add", b>> :> "idle" @@ <<"add", c>> :> "acked" @@ <<"del", a>> :> "idle" @@ <<"del", b>> :> "idle"),mem |-> {a, c},restarts |-> 0,queue |-> <<[snap |-> {a}, req |-> <<"add", a>>]>>]),
    ([broken |-> FALSE,disk |-> {a},failures |-> 0,pc |-> (<<"add", a>> :> "acked" @@ <<"add", b>> :> "idle" @@ <<"add", c>> :> "acked" @@ <<"del", a>> :> "idle" @@ <<"del", b>> :> "idle"),mem |-> {a, c},restarts |-> 0,queue |-> <<>>])
    >>
----


=============================================================================

---- MODULE NotesPersistence_TEConstants ----
EXTENDS NotesPersistence

CONSTANTS a, b, c

=============================================================================

---- CONFIG NotesPersistence_TTrace_1792848393 ----
CONSTANTS
    a = a
    b = b
    Items = { a , b , c }
    DeleteItems = { a , b }
    MaxFailures = 0
    MaxRestarts = 2
    Serialized = FALSE
    c = c
    a = a
    b = b

INVARIANT
    _inv

CHECK_DEADLOCK
    \* CHECK_DEADLOCK off because of PROPERTY or INVARIANT above.
    FALSE

INIT
    _init

NEXT
    _next

CONSTANT
    _TETrace <- _trace

ALIAS
    _expression
=============================================================================
\* Generated on Sat Oct 24 13:26:34 UTC 2026