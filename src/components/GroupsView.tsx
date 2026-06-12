import { flagUrl, type GroupTable } from "../data/fifa";

export function GroupsView({ tables }: { tables: GroupTable[] }) {
  if (!tables.length) {
    return <div className="panel-empty">No group data yet.</div>;
  }
  return (
    <div className="groups-grid">
      {tables.map((t) => (
        <div className="group-card" key={t.idGroup}>
          <div className="group-title">{t.group}</div>
          <table className="group-table">
            <thead>
              <tr>
                <th className="c-pos">#</th>
                <th className="c-team">Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GD</th>
                <th className="c-pts">Pts</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, i) => (
                <tr key={r.code} className={i < 2 ? "qualifies" : ""}>
                  <td className="c-pos">{i + 1}</td>
                  <td className="c-team">
                    {r.code && (
                      <img className="mini-flag" src={flagUrl(r.code)!} alt="" />
                    )}
                    <span className="mini-team">{r.name}</span>
                  </td>
                  <td>{r.pld}</td>
                  <td>{r.w}</td>
                  <td>{r.d}</td>
                  <td>{r.l}</td>
                  <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="c-pts">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
