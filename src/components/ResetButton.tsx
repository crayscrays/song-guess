import { useState } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RESULTS_STORAGE_KEY = "jay-chou-tune-trek/results";
const PROGRESS_STORAGE_PREFIX = "jay-chou-tune-trek/progress/";

export const ResetButton = () => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleReset = () => {
    try {
      // Clear all results
      localStorage.removeItem(RESULTS_STORAGE_KEY);

      // Clear all progress entries
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PROGRESS_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      setIsConfirmOpen(false);
      
      // Reload the page to reset the game state
      window.location.reload();
    } catch (error) {
      console.error("Failed to clear game data:", error);
      alert("Failed to clear game data. Please try again.");
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsConfirmOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-20 right-4 z-50 rounded-full p-2 h-auto bg-destructive/10 hover:bg-destructive/20 border-destructive/30"
        title="Reset Game Data"
      >
        <RotateCcw className="w-4 h-4 text-destructive" />
      </Button>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-3xl mx-auto max-w-xs sm:max-w-md">
          <AlertDialogHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
            <AlertDialogTitle>Reset Game Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your game progress, results, and saved data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center sm:space-x-4">
            <AlertDialogCancel onClick={() => setIsConfirmOpen(false)} className="rounded-full px-6">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="rounded-full px-6 bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0"
            >
              Reset All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

