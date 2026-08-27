import { FocusButton } from "@/lib/tv-focus";
import { REPO_URL } from "@/lib/brand";
import { GitPullRequest, Github } from "lucide-react";
import { openUrl } from "@/lib/window";

const REPO = REPO_URL;

export function ContributorCard() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge-soft/70 bg-canvas/30 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-ink">
          <GitPullRequest size={15} strokeWidth={1.9} />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-semibold text-ink">Want to fix it yourself?</h3>
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            Viora is open source. PRs that reference a bug get reviewed within 48h and ship with credit
            in the release notes.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {REPO && <FocusButton
          type="button"
          onClick={() => openUrl(REPO)}
          className="flex h-9 items-center gap-2 rounded-lg border border-edge-soft bg-elevated px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <Github size={13} strokeWidth={1.9} />
          Open repo on GitHub
        </FocusButton>}
        <FocusButton
          type="button"
          onClick={() => openUrl(`${REPO}/pulls`)}
          className="flex h-9 items-center gap-2 rounded-lg border border-edge-soft bg-elevated px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <GitPullRequest size={13} strokeWidth={1.9} />
          Browse pull requests
        </FocusButton>
      </div>
    </div>
  );
}
