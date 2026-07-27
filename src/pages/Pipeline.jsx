import { useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useCustomers, useProducts, useTickets } from "../context/domains.jsx";
import { TICKET_STAGES, WON_STAGES, LOST_STAGES } from "../data/schema";
import { formatDate } from "../utils/helpers";

const STAGE_TEXT = { loom: "text-loom", rust: "text-rust", ink: "text-muted" };

export default function Pipeline() {
  const { items: customers } = useCustomers();
  const { items: products } = useProducts();
  const { items: tickets, save } = useTickets();

  const customerName = (id) => customers.find((c) => c.id === id)?.name || "—";
  const productName = (id) => products.find((p) => p.id === id)?.qualityName || "—";

  const columns = useMemo(() => {
    const map = {};
    TICKET_STAGES.forEach((s) => (map[s] = []));
    tickets.forEach((t) => {
      if (map[t.stage]) map[t.stage].push(t);
    });
    return map;
  }, [tickets]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;
    const ticket = tickets.find((t) => t.id === draggableId);
    if (ticket) save({ ...ticket, stage: destination.droppableId });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-extrabold text-2xl">Pipeline</h1>
        <p className="text-muted text-sm mt-1">Drag a card to move its stage.</p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          {TICKET_STAGES.map((stage) => {
            const tone = WON_STAGES.includes(stage) ? "loom" : LOST_STAGES.includes(stage) ? "rust" : "ink";
            return (
              <Droppable droppableId={stage} key={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`shrink-0 w-64 bg-panel border border-line rounded-2xl p-3 flex flex-col gap-2 ${
                      snapshot.isDraggingOver ? "ring-2 ring-ink2/30" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between px-1">
                      <h3 className={`font-display font-bold text-xs uppercase tracking-wide ${STAGE_TEXT[tone]}`}>
                        {stage}
                      </h3>
                      <span className="text-xs text-muted bg-paper rounded-full px-2 py-0.5">{columns[stage].length}</span>
                    </div>
                    <div className="flex flex-col gap-2 min-h-[40px]">
                      {columns[stage].map((t, idx) => (
                        <Draggable draggableId={t.id} index={idx} key={t.id}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`bg-white border border-line rounded-xl p-3 text-xs shadow-sm ${
                                dragSnapshot.isDragging ? "shadow-lg" : ""
                              }`}
                            >
                              <div className="font-mono text-[10px] text-muted">{t.ticketNumber}</div>
                              <div className="font-semibold text-sm mt-0.5 truncate">{customerName(t.customerId)}</div>
                              <div className="text-muted mt-0.5 truncate">{productName(t.productId)} · {t.shade}</div>
                              <div className="text-muted mt-1">{formatDate(t.date)}</div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
