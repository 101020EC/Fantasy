import { FPLBootstrap, FPLEntry, FPLPicksResponse, FPLFixture, TeamSquadPlayer } from './types';
import { analyzePlayerPrice } from './price-calculator';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function fetchFPLBootstrap(): Promise<FPLBootstrap> {
  try {
    const res = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Bootstrap fetch failed (${res.status})`);
    }

    return res.json();
  } catch (error: any) {
    throw new Error(`ไม่สามารถโหลดข้อมูลผู้เล่น FPL ได้: ${error.message}`);
  }
}

export async function fetchFPLEntry(teamId: number | string): Promise<FPLEntry> {
  try {
    const res = await fetch(`${FPL_BASE}/entry/${teamId}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`ไม่พบข้อมูลทีม ID: ${teamId} (กรุณาตรวจ Team ID)`);
    }

    return res.json();
  } catch (error: any) {
    throw new Error(`ไม่พบทีม ID: ${teamId} (${error.message})`);
  }
}

export async function fetchFPLPicks(teamId: number | string, eventId: number | string): Promise<FPLPicksResponse> {
  const res = await fetch(`${FPL_BASE}/entry/${teamId}/event/${eventId}/picks/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`ไม่พบข้อมูลการจัดตัวใน GW ${eventId}`);
  }

  return res.json();
}

export async function fetchFPLFixtures(): Promise<FPLFixture[]> {
  try {
    const res = await fetch(`${FPL_BASE}/fixtures/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      return [];
    }

    return res.json();
  } catch {
    return [];
  }
}

export function buildSquadPlayers(
  picks: FPLPicksResponse['picks'] = [],
  bootstrap: FPLBootstrap,
  fixtures: FPLFixture[] = [],
  currentEventId: number = 1
): TeamSquadPlayer[] {
  const elementMap = new Map(bootstrap.elements.map((el) => [el.id, el]));
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const typeMap = new Map(bootstrap.element_types.map((et) => [et.id, et]));

  const upcomingFixtures = fixtures.filter(
    (f) => f.event === currentEventId || f.event === currentEventId + 1
  );

  return (picks || [])
    .map((pick) => {
      const element = elementMap.get(pick.element);
      if (!element) return null;

      const team = teamMap.get(element.team) || {
        id: element.team,
        name: 'Club',
        short_name: 'CLB',
        code: 0,
        strength: 3,
      };

      const elementType = typeMap.get(element.element_type) || {
        id: element.element_type,
        plural_name: 'Players',
        plural_name_short: 'PLY',
        singular_name: 'Player',
        singular_name_short: 'PLY',
      };

      const priceAnalysis = analyzePlayerPrice(element, bootstrap);

      const nextFix = upcomingFixtures.find(
        (f) => f.team_h === element.team || f.team_a === element.team
      );

      let nextFixtureInfo = undefined;
      if (nextFix) {
        const isHome = nextFix.team_h === element.team;
        const opponentId = isHome ? nextFix.team_a : nextFix.team_h;
        const opponent = teamMap.get(opponentId) || {
          id: opponentId,
          name: 'Opponent',
          short_name: 'OPP',
          code: 0,
          strength: 3,
        };
        const difficulty = isHome ? nextFix.team_h_difficulty : nextFix.team_a_difficulty;

        nextFixtureInfo = {
          opponent,
          isHome,
          difficulty,
        };
      }

      return {
        pick,
        element,
        team,
        elementType,
        priceAnalysis,
        nextFixture: nextFixtureInfo,
      };
    })
    .filter(Boolean) as TeamSquadPlayer[];
}
