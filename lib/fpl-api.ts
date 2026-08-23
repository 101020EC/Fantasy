import { FPLBootstrap, FPLEntry, FPLPicksResponse, FPLFixture, TeamSquadPlayer } from './types';
import { analyzePlayerPrice } from './price-calculator';

const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function fetchFPLBootstrap(): Promise<FPLBootstrap> {
  const res = await fetch(`${FPL_BASE}/bootstrap-static/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    next: { revalidate: 300 }, // Cache 5 min
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch FPL bootstrap: ${res.statusText}`);
  }

  return res.json();
}

export async function fetchFPLEntry(teamId: number | string): Promise<FPLEntry> {
  const res = await fetch(`${FPL_BASE}/entry/${teamId}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`ไม่พบข้อมูลทีม ID: ${teamId} กรุณาตรวจสอบ Team ID อีกครั้ง`);
  }

  return res.json();
}

export async function fetchFPLPicks(teamId: number | string, eventId: number | string): Promise<FPLPicksResponse> {
  const res = await fetch(`${FPL_BASE}/entry/${teamId}/event/${eventId}/picks/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`ไม่พบข้อมูลการจัดตัวใน Gameweek ${eventId}`);
  }

  return res.json();
}

export async function fetchFPLFixtures(): Promise<FPLFixture[]> {
  const res = await fetch(`${FPL_BASE}/fixtures/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    next: { revalidate: 1800 }, // 30 mins
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export function buildSquadPlayers(
  picks: FPLPicksResponse['picks'],
  bootstrap: FPLBootstrap,
  fixtures: FPLFixture[] = [],
  currentEventId: number = 1
): TeamSquadPlayer[] {
  const elementMap = new Map(bootstrap.elements.map((el) => [el.id, el]));
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const typeMap = new Map(bootstrap.element_types.map((et) => [et.id, et]));

  // Find next fixtures for current/upcoming event
  const upcomingFixtures = fixtures.filter(
    (f) => f.event === currentEventId || f.event === currentEventId + 1
  );

  return picks.map((pick) => {
    const element = elementMap.get(pick.element)!;
    const team = teamMap.get(element.team)!;
    const elementType = typeMap.get(element.element_type)!;
    const priceAnalysis = analyzePlayerPrice(element, bootstrap);

    // Find next fixture for this player's team
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
  });
}
