import * as THREE from 'three';

/**
 * 3D Procedural Ship Model Generator for Port of Call.
 * Accurately creates distinct 3D models matching each of the 5 vessel blueprints:
 * 1. Tramp Steamer: Vintage 1930s midships wheelhouse, derrick masts, classic steam funnel
 * 2. Cargo Liner: Modern freighter with dual yellow deck cranes, aft bridge, radar
 * 3. Bulk Carrier: Massive heavy iron hull, 6 large cargo hatch bays, tall aft block
 * 4. Container Ship: Sleek high-speed hull, multi-tier colorful container stacks, tall slim bridge
 * 5. Supertanker: Colossal wide hull, deck catwalk & pipeline manifolds, midships hose crane, twin funnels
 * 
 * Incorporates the player's custom company color prominently across hull bands,
 * superstructure accents, and funnels.
 */
export function buildShip3DModel(type: string, playerColor: string = '#00d2ff'): THREE.Group {
  const ship = new THREE.Group();
  const hexColor = parseInt(playerColor.replace('#', '0x'), 16) || 0x00d2ff;

  // Materials with vibrant, high-clarity lighting response
  const companyMat = new THREE.MeshStandardMaterial({
    color: hexColor,
    roughness: 0.25,
    metalness: 0.15
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.3 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.4 });
  const redKeelMat = new THREE.MeshStandardMaterial({ color: 0x961a1a, roughness: 0.45 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x3d4b59, roughness: 0.65 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xffa502, roughness: 0.35 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, roughness: 0.45 });

  switch (type) {
    case 'tramp':
    case 'tramp_steamer': {
      // 1. Coastal Tramp (Vintage 1930s steamer, midships wheelhouse, derricks fore & aft)
      // Lower Keel
      const keel = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 68), redKeelMat);
      keel.position.y = 1.2;
      ship.add(keel);

      // Main Hull
      const hull = new THREE.Mesh(new THREE.BoxGeometry(17.5, 6.5, 70), darkSteelMat);
      hull.position.y = 5.8;
      hull.castShadow = true;
      ship.add(hull);

      // Vivid Hull Company Stripe
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 70.2), companyMat);
      stripe.position.y = 7.8;
      ship.add(stripe);

      // Main Deck
      const deck = new THREE.Mesh(new THREE.BoxGeometry(17, 0.4, 69.2), deckMat);
      deck.position.y = 9.2;
      ship.add(deck);

      // Midships Superstructure
      const bridgeLower = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 18), whiteMat);
      bridgeLower.position.set(0, 13.2, 4);
      bridgeLower.castShadow = true;
      ship.add(bridgeLower);

      const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), whiteMat);
      wheelhouse.position.set(0, 19, 4);
      ship.add(wheelhouse);

      // Bridge Windows (Forward facing)
      const win = new THREE.Mesh(new THREE.BoxGeometry(11.8, 1.8, 0.4), windowMat);
      win.position.set(0, 19.5, -2.1);
      ship.add(win);

      // Vintage Funnel in company color
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.8, 11, 14), companyMat);
      funnel.position.set(0, 23.5, 8);
      ship.add(funnel);
      const funnelCap = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 2.2, 14), darkSteelMat);
      funnelCap.position.set(0, 29, 8);
      ship.add(funnelCap);

      // Forward & Aft Cargo Hatches
      for (const z of [-18, 22]) {
        const hatch = new THREE.Mesh(new THREE.BoxGeometry(11, 2, 12), darkSteelMat);
        hatch.position.set(0, 10.2, z);
        ship.add(hatch);
      }

      // Derricks / Masts
      for (const z of [-28, 18]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 20), mastMat);
        mast.position.set(0, 18, z);
        ship.add(mast);
      }
      break;
    }

    case 'freighter':
    case 'general_freighter': {
      // 2. General Freighter (Cargo Liner with deck cranes, aft bridge)
      const keel = new THREE.Mesh(new THREE.BoxGeometry(18, 5.5, 82), redKeelMat);
      keel.position.y = 1.2;
      ship.add(keel);

      const hull = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 84), new THREE.MeshStandardMaterial({ color: 0x2c3e50 }));
      hull.position.y = 6.5;
      hull.castShadow = true;
      ship.add(hull);

      // Prominent company color hull stripe
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(20.5, 1.6, 84.2), companyMat);
      stripe.position.y = 8.8;
      ship.add(stripe);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.4, 83.4), deckMat);
      deck.position.y = 10.2;
      ship.add(deck);

      // Cargo Hatches
      for (const z of [-24, -6, 12]) {
        const hatch = new THREE.Mesh(new THREE.BoxGeometry(13, 2.2, 12), darkSteelMat);
        hatch.position.set(0, 11.2, z);
        ship.add(hatch);
      }

      // Yellow Deck Cranes
      for (const z of [-15, 3]) {
        const cranePost = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 11), mastMat);
        cranePost.position.set(0, 15.5, z);
        ship.add(cranePost);
        const craneBoom = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 15), craneMat);
        craneBoom.position.set(0, 19, z - 4.5);
        craneBoom.rotation.x = 0.35;
        ship.add(craneBoom);
      }

      // Aft Castle Superstructure
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(16, 13, 16), whiteMat);
      bridge.position.set(0, 16.8, 28);
      bridge.castShadow = true;
      ship.add(bridge);

      // Bridge Windows
      const win = new THREE.Mesh(new THREE.BoxGeometry(15.8, 2.2, 0.4), windowMat);
      win.position.set(0, 21.2, 19.8);
      ship.add(win);

      // Funnel with company color
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 11, 14), companyMat);
      funnel.position.set(0, 26, 32);
      ship.add(funnel);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.2, 14), darkSteelMat);
      cap.position.set(0, 31.5, 32);
      ship.add(cap);

      // Radar Scanner
      const radar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 1), windowMat);
      radar.position.set(0, 24.5, 28);
      ship.add(radar);
      break;
    }

    case 'bulk':
    case 'bulk_carrier': {
      // 3. Bulk Carrier (Long industrial hull, 6 large grey hatch covers, tall aft block)
      const keel = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 102), new THREE.MeshStandardMaterial({ color: 0x7a1414 }));
      keel.position.y = 1.2;
      ship.add(keel);

      const hull = new THREE.Mesh(new THREE.BoxGeometry(24, 7.8, 104), darkSteelMat);
      hull.position.y = 7.1;
      hull.castShadow = true;
      ship.add(hull);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(24.5, 1.8, 104.2), companyMat);
      stripe.position.y = 9.8;
      ship.add(stripe);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(23.4, 0.4, 103.4), deckMat);
      deck.position.y = 11;
      ship.add(deck);

      // Raised Forecastle at bow
      const fwdCastle = new THREE.Mesh(new THREE.BoxGeometry(22, 3.5, 14), darkSteelMat);
      fwdCastle.position.set(0, 12.5, -45);
      ship.add(fwdCastle);

      // 6 Large Bulk Cargo Hatches
      const hatchMat = new THREE.MeshStandardMaterial({ color: 0x57606f, roughness: 0.6 });
      const hatchZ = [-33, -19, -5, 9, 23, 37];
      for (const z of hatchZ) {
        const hatch = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 10), hatchMat);
        hatch.position.set(0, 12.1, z);
        ship.add(hatch);
      }

      // Tall Aft Accommodation Block
      const tower = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 14), whiteMat);
      tower.position.set(0, 20, 45);
      tower.castShadow = true;
      ship.add(tower);

      const win = new THREE.Mesh(new THREE.BoxGeometry(17.8, 2.5, 0.4), windowMat);
      win.position.set(0, 25.5, 37.8);
      ship.add(win);

      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.2, 11, 14), companyMat);
      funnel.position.set(0, 30.5, 48);
      ship.add(funnel);
      break;
    }

    case 'container':
    case 'container_ship': {
      // 4. Modern Container Ship (Sleek hull, colorful container stacks, tall slim bridge)
      const keel = new THREE.Mesh(new THREE.BoxGeometry(21, 6, 110), redKeelMat);
      keel.position.y = 1.2;
      ship.add(keel);

      const hull = new THREE.Mesh(new THREE.BoxGeometry(23, 8, 112), new THREE.MeshStandardMaterial({ color: 0x192a56 }));
      hull.position.y = 7.2;
      hull.castShadow = true;
      ship.add(hull);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(23.5, 1.8, 112.2), companyMat);
      stripe.position.y = 10.2;
      ship.add(stripe);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(22.4, 0.4, 111.4), deckMat);
      deck.position.y = 11.4;
      ship.add(deck);

      // Container Stacks (Vibrant container colors: red, blue, green, orange, purple, cyan)
      const boxColors = [0xeb4d4b, 0x0984e3, 0x2ed573, 0xf0932b, 0x8e44ad, 0x00d2ff];
      const bayZ = [-42, -28, -14, 0, 14];
      let colorIdx = 0;
      for (const z of bayZ) {
        for (let row = -1; row <= 1; row += 2) {
          const tierCount = 3;
          for (let tier = 0; tier < tierCount; tier++) {
            const col = boxColors[colorIdx++ % boxColors.length];
            const cMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 });
            const box = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4.5, 12), cMat);
            box.position.set(row * 5.2, 13.8 + tier * 4.6, z);
            box.castShadow = true;
            ship.add(box);
          }
        }
      }

      // Slim Bridge Tower placed near 3/4 aft
      const tower = new THREE.Mesh(new THREE.BoxGeometry(18, 21, 12), whiteMat);
      tower.position.set(0, 22, 34);
      tower.castShadow = true;
      ship.add(tower);

      const win = new THREE.Mesh(new THREE.BoxGeometry(17.8, 2.5, 0.4), windowMat);
      win.position.set(0, 29, 27.8);
      ship.add(win);

      // High Funnel
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 13, 14), companyMat);
      funnel.position.set(0, 33.5, 41);
      ship.add(funnel);

      // Aft Container Bay
      const aftBox = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 10), new THREE.MeshStandardMaterial({ color: 0xeb4d4b }));
      aftBox.position.set(0, 15.6, 48);
      ship.add(aftBox);
      break;
    }

    case 'tanker':
    case 'super_tanker': {
      // 5. Supertanker (Colossal wide hull, pipeline catwalk & manifolds, twin funnels)
      const keel = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 122), new THREE.MeshStandardMaterial({ color: 0x6b0e0e }));
      keel.position.y = 1.2;
      ship.add(keel);

      const hull = new THREE.Mesh(new THREE.BoxGeometry(28, 8.5, 124), new THREE.MeshStandardMaterial({ color: 0x2d3436 }));
      hull.position.y = 7.5;
      hull.castShadow = true;
      ship.add(hull);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(28.6, 2.2, 124.2), companyMat);
      stripe.position.y = 10.6;
      ship.add(stripe);

      const deck = new THREE.Mesh(new THREE.BoxGeometry(27.6, 0.4, 123.4), deckMat);
      deck.position.y = 11.9;
      ship.add(deck);

      // Central Pipeline Trunk / Catwalk running from bow to bridge
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 90), darkSteelMat);
      trunk.position.set(0, 12.9, -8);
      ship.add(trunk);

      // Pipeline Manifold Domes along the deck
      const domeMat = new THREE.MeshStandardMaterial({ color: 0x747d8c, roughness: 0.3 });
      for (const z of [-45, -25, -5, 15]) {
        const dome = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 2.5, 8), domeMat);
        dome.position.set(6, 13.2, z);
        ship.add(dome);
        const dome2 = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 2.5, 8), domeMat);
        dome2.position.set(-6, 13.2, z);
        ship.add(dome2);
      }

      // Midships Hose Handling Crane
      const crane = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.2), craneMat);
      crane.position.set(0, 17, -5);
      ship.add(crane);
      const boom = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 14), craneMat);
      boom.position.set(0, 21.5, -5);
      boom.rotation.z = 0.5;
      ship.add(boom);

      // Massive Aft Castle Superstructure
      const castle = new THREE.Mesh(new THREE.BoxGeometry(24, 17, 16), whiteMat);
      castle.position.set(0, 20.4, 48);
      castle.castShadow = true;
      ship.add(castle);

      const win = new THREE.Mesh(new THREE.BoxGeometry(23.8, 2.5, 0.4), windowMat);
      win.position.set(0, 25.8, 39.8);
      ship.add(win);

      // Twin Funnels in company color
      for (const x of [-6, 6]) {
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 12, 14), companyMat);
        funnel.position.set(x, 29.5, 52);
        ship.add(funnel);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 2, 14), darkSteelMat);
        cap.position.set(x, 36, 52);
        ship.add(cap);
      }
      break;
    }

    default: {
      // Fallback
      const hull = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 75), darkSteelMat);
      hull.position.y = 5;
      ship.add(hull);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(18.4, 1.5, 75.2), companyMat);
      stripe.position.y = 7.5;
      ship.add(stripe);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 14), whiteMat);
      bridge.position.set(0, 14, 20);
      ship.add(bridge);
      break;
    }
  }

  return ship;
}
