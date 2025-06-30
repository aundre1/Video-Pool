import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import ReactPlayer from "react-player";

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
  description?: string;
}

export function PlayerModal({ isOpen, onClose, videoUrl, title, description }: PlayerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] p-0 bg-dark-card">
        <DialogHeader className="p-4 pb-0">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-lg">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="relative aspect-video w-full">
          <ReactPlayer
            url={videoUrl}
            width="100%"
            height="100%"
            controls
            playing
            config={{
              file: {
                attributes: {
                  controlsList: "nodownload",
                  disablePictureInPicture: true,
                },
              },
            }}
          />
        </div>
        <div className="p-4 flex justify-end">
          <DialogClose asChild>
            <Button variant="outline">Close Preview</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
