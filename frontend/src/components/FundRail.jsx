import { eth } from "../lib/escrow-ui";
import { StateBlock } from "./RoleBadge";

/**
 * Rel arus dana: tiga zona yang menunjukkan di mana dana tiap milestone berada.
 * Varian "blocks" untuk ringkasan banyak proyek, "cards" untuk satu proyek.
 */
export function FundRail({ zones, variant = "blocks" }) {
  return (
    <section className={`rail rail-${variant}`} aria-label="Posisi dana">
      {zones.map((z) => (
        <div key={z.key} className={`zone zone-${z.key}`}>
          <div className="zone-head">
            <span>{z.label}</span>
            <span>{variant === "cards" ? `${eth(z.total)} ETH` : `${z.items.length} milestone`}</span>
          </div>
          {variant === "blocks" && (
            <div className="zone-amount">
              {eth(z.total)}
              <span>ETH</span>
            </div>
          )}
          <div className="zone-items">
            {z.items.length === 0 && <span className="zone-empty">Kosong</span>}
            {z.items.map((it) =>
              variant === "cards" ? (
                <div key={it.key} className={`zone-card zone-card-${it.state}`}>
                  <span>Milestone {it.index + 1}</span>
                  <strong>{eth(it.amount)}</strong>
                </div>
              ) : (
                <StateBlock key={it.key} state={it.state} title={it.title} />
              ),
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
