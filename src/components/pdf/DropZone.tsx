import { useCallback, useState } from "react";
import { FileUp, FileText } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
}

export function DropZone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type === "application/pdf") {
        onFile(file);
      }
    },
    [onFile],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-viewer-bg">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full max-w-xl aspect-[4/3] rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-4 bg-card ${
          dragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        }`}
      >
        <input type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
        <div
          className={`p-5 rounded-full bg-primary/10 text-primary transition-transform ${
            dragging ? "scale-110" : ""
          }`}
        >
          {dragging ? <FileText className="h-10 w-10" /> : <FileUp className="h-10 w-10" />}
        </div>
        <div className="text-center px-6">
          <p className="text-lg font-medium text-foreground">
            Trascina qui il tuo PDF o fai clic per caricare
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            I file rimangono sul tuo dispositivo. Nessun upload sul server.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          Formato supportato: <span className="font-mono">.pdf</span>
        </div>
      </label>
    </div>
  );
}
