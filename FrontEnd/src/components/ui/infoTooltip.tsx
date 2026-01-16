import { HelpCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

type InfoTooltipProps = {
  text: string
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ml-1 inline-flex items-center text-muted-foreground hover:text-primary transition"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        className="max-w-xs text-xs text-muted-foreground"
      >
        {text}
      </PopoverContent>
    </Popover>
  )
}
