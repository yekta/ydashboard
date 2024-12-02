"use client";

import { useEditMode } from "@/components/providers/edit-mode-provider";

import {
  dndItemType,
  useDnd,
} from "@/app/[username]/[dashboard_slug]/_components/dnd-provider";
import { useCurrentDashboard } from "@/app/[username]/[dashboard_slug]/_components/current-dashboard-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/server/trpc/setup/react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { LoaderIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { ComponentProps, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type TCardOuterWrapperDivProps = ComponentProps<"div"> & {
  href?: undefined;
  isRemovable?: boolean;
  cardId?: string;
};
export type TCardOuterWrapperLinkProps = ComponentProps<typeof Link> & {
  isRemovable?: boolean;
  cardId?: string;
};
export type TCardOuterWrapperButtonProps = ComponentProps<"button"> & {
  href?: undefined;
  onClick?: () => void;
  isRemovable?: boolean;
  cardId?: string;
};

export type TCardOuterWrapperProps =
  | TCardOuterWrapperDivProps
  | TCardOuterWrapperLinkProps
  | TCardOuterWrapperButtonProps;

type TDndState = "idle" | "dragging" | "over" | "preview";

type TSize = {
  width: number;
  height: number;
};
const defaultCardSize: TSize = { width: 100, height: 50 };

export default function CardOuterWrapper({
  className,
  children,
  isRemovable,
  cardId,
  ...rest
}: TCardOuterWrapperProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const classNameAll = cn(
    "flex flex-col p-1 group/card col-span-12 relative focus:outline-none",
    className
  );

  const { invalidateCards, isPendingCardInvalidation } = useCurrentDashboard();

  const { isEnabled: isEditModeEnabled } = useEditMode();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dndState, setDndState] = useState<TDndState>("idle");
  const [preview, setPreview] = useState<HTMLElement | null>(null);
  const [cardSize, setCardSize] = useState<TSize>(defaultCardSize);
  const { instanceId } = useDnd();

  const { mutate: deleteCard, isPending: isPendingDelete } =
    api.ui.deleteCards.useMutation({
      onSuccess: async () => {
        await invalidateCards();
      },
    });

  const isPendingAny = isPendingDelete || isPendingCardInvalidation;

  const onDeleteClick = async ({ cardId }: { cardId: string }) => {
    if (!cardId) return;
    deleteCard({ ids: [cardId] });
  };

  useEffect(() => {
    if (!isEditModeEnabled || !ref.current) return;
    const el = ref.current;

    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: dndItemType, cardId, instanceId }),
        onDragStart: () => {
          setDndState("dragging");
        },
        onDrop: () => {
          setDndState("idle");
          setPreview(null);
          setCardSize(defaultCardSize);
        },

        onGenerateDragPreview({ nativeSetDragImage }) {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            render({ container }) {
              if (ref.current) {
                const { width, height } = ref.current.getBoundingClientRect();
                setCardSize({ width, height });
              }
              setPreview(container);
            },
          });
        },
      }),
      dropTargetForElements({
        element: el,
        getData: () => ({ cardId }),
        canDrop: ({ source }) =>
          source.data.instanceId === instanceId &&
          source.data.type === dndItemType &&
          source.data.cardId !== cardId,
        onDragEnter: () => setDndState("over"),
        onDragLeave: () => setDndState("idle"),
        onDrop: () => setDndState("idle"),
      })
    );
  }, [instanceId, isEditModeEnabled, cardId]);

  if (isEditModeEnabled && cardId) {
    const restDiv = rest as TCardOuterWrapperDivProps;
    return (
      <div
        className={cn(
          classNameAll,
          "data-[dnd-active]:data-[dnd-dragging]:opacity-50 relative data-[dnd-active]:cursor-grab data-[dnd-over]:z-20"
        )}
        data-dnd-active={isEditModeEnabled ? true : undefined}
        data-dnd-over={dndState === "over" ? true : undefined}
        data-dnd-dragging={dndState === "dragging" ? true : undefined}
        {...restDiv}
        ref={ref}
      >
        {children}
        {/* To block the content below */}
        {isEditModeEnabled && (
          <div className="w-full h-full inset-0 absolute z-10" />
        )}
        {/* Vertical indicator */}
        {isEditModeEnabled && (
          <div className="absolute left-0.5 top-0 py-1 h-full pointer-events-none">
            <div
              className="group-data-[dnd-over]/card:scale-y-100 
                group-data-[dnd-over]/card:opacity-100 transition rounded-full
                opacity-0 scale-y-0 w-1 -translate-x-1/2 h-full z-10 bg-primary"
            />
          </div>
        )}
        {/* Preview for the dragging element */}
        {isEditModeEnabled &&
          preview &&
          createPortal(
            <CardPreview className={classNameAll} cardSize={cardSize} />,
            preview
          )}
        {/* Delete card button */}
        {isEditModeEnabled && isRemovable && cardId && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                state={isPendingAny ? "loading" : "default"}
                onClick={() => setIsDialogOpen(true)}
                size="icon"
                variant="outline"
                className="absolute left-0 top-0 size-7 rounded-full z-10 transition text-foreground shadow-md 
                  shadow-shadow/[var(--opacity-shadow)] group-data-[dnd-over]/card:scale-0 group-data-[dnd-dragging]/card:scale-0
                  group-data-[dnd-over]/card:opacity-0 group-data-[dnd-dragging]/card:opacity-0"
              >
                <div className="size-4">
                  {isPendingAny ? (
                    <LoaderIcon className="size-full animate-spin" />
                  ) : (
                    <XIcon className="size-full" />
                  )}
                </div>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  Are you sure?
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. Are you sure you want to delete
                  this card?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end flex-wrap gap-2">
                <Button
                  onClick={() => setIsDialogOpen(false)}
                  variant="outline"
                  className="border-none text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => onDeleteClick({ cardId })}
                  state={isPendingAny ? "loading" : "default"}
                  data-pending={isPendingAny ? true : undefined}
                  variant="destructive"
                  className="group/button"
                >
                  {isPendingAny && (
                    <div className="size-6 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <LoaderIcon className="size-full animate-spin" />
                    </div>
                  )}
                  <span className="group-data-[pending]/button:text-transparent">
                    Delete
                  </span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  if ("href" in rest && rest.href) {
    const {
      target = "_blank",
      href,
      ...restLink
    } = rest as TCardOuterWrapperLinkProps;
    return (
      <Link
        data-has-href={href ? true : undefined}
        href={href}
        {...restLink}
        className={classNameAll}
        target={target}
      >
        {children}
      </Link>
    );
  }
  if ("onClick" in rest && rest.onClick) {
    const restButton = rest as TCardOuterWrapperButtonProps;
    return (
      <button {...restButton} className={classNameAll}>
        {children}
      </button>
    );
  }

  const restDiv = rest as TCardOuterWrapperDivProps;
  return (
    <div {...restDiv} className={classNameAll}>
      {children}
    </div>
  );
}

function CardPreview({
  cardSize,
  className,
}: {
  cardSize: { width: number; height: number };
  className?: string;
}) {
  return (
    <div
      style={{
        width: `${(2 * cardSize.width) / 3}px`,
        height: `${(2 * cardSize.height) / 3}px`,
      }}
      className={cn(
        className,
        "bg-background border border-dashed border-foreground rounded-xl relative"
      )}
    />
  );
}
