import { useState } from "react";
import { supabase } from "../../utils/supabase";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreatePCButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: insertError } = await supabase.from("computers").insert([
        { name, status: true },
      ]);
      if (insertError) throw insertError;
      setSuccess("PC created successfully");
      setName("");
      setOpen(false);
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "message" in err) {
        setError((err as { message?: string }).message || "Error creating PC");
      } else {
        setError("Error creating PC");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="mb-8 bg-black text-white hover:bg-gray-900" variant="secondary">Create PC</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create PC</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Enter computer name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={loading}
        />
        {error && <div className="text-red-500 mt-2">{error}</div>}
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
          <DialogClose asChild>
            <Button variant="secondary" disabled={loading} type="button">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
        {success && (
          <div className="mt-4 text-green-600 font-semibold">{success}</div>
        )}
      </DialogContent>
    </Dialog>
  );
} 