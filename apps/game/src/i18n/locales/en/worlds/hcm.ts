/** English source text for the `worlds` namespace, `hcm` area. Owns one top-level key group. */
// UI labels only. Landmark names stay literal in `features/hochiminh/types.ts`; place names such as
// "Bến Thành" or "Thủ Thiêm" keep their Vietnamese spelling in both locales.
const hcm = {
  hcm: {
    back: {
      label: "Game Menu",
      title: "Back to the game menu",
    },
    header: {
      title: "Ho Chi Minh City 2025 · 3D Map",
    },
    themes: {
      daylight: "Daylight",
      cyberpunk: "Cyberpunk",
      sunset: "Sunset",
      blueprint: "Tech Map",
    },
    controls: {
      autoRotateStop: "Stop auto-rotate",
      autoRotateStart: "Start auto-rotate",
      landmarksHide: "Hide landmarks",
      landmarksShow: "Show 3D landmarks",
      info: "3D model information",
      fullscreenExit: "Exit full screen",
      fullscreenEnter: "Full screen",
    },
    landmarkCard: {
      heading: "Featured Landmark",
    },
    landmarks: {
      bitexco: {
        title: "The lotus bud symbol of Sài Gòn",
        description:
          "A 68-floor, 262 m tower with a helipad that extends out from the 52nd floor. It was once a leading symbol of modern architecture in Vietnam.",
      },
      benthanh: {
        title: "Historic heart and modern city",
        description:
          "The central District 1 area that links the historic Bến Thành Market, Quách Thị Trang Square and the underground Bến Thành – Suối Tiên metro station.",
      },
      bachdang: {
        title: "Riverside park and water bus pier",
        description:
          "A park on the Sài Gòn River bank with a cool breeze and a full view of the District 1 skyline and the new Thủ Thiêm urban area across the river.",
      },
      bason: {
        title: "Gateway between District 1 and Thủ Thiêm",
        description:
          "A curved cable-stayed bridge across the Sài Gòn River. It is a symbol of the city's fast growth toward the east bank.",
      },
      thuthiem: {
        title: "Future new financial center",
        description:
          "Rich land across the Sài Gòn River, planned for the largest central square in the country and other major buildings.",
      },
    },
    views: {
      heading: "View:",
      overview: {
        label: "Sài Gòn Overview",
        shortLabel: "Overview",
        description:
          "Aerial drone view of a 3km x 3km area of central Ho Chi Minh City along the Sài Gòn River",
      },
      bitexco: {
        label: "Bitexco Tower",
        shortLabel: "Bitexco",
        description: "Close-up view of the lotus-shaped Bitexco Financial Tower and the riverside square",
      },
      river: {
        label: "Along the Sài Gòn River",
        shortLabel: "Sài Gòn River",
        description: "Move along the Sài Gòn River and see both banks, District 1 and Thủ Thiêm",
      },
      benthanh: {
        label: "Bến Thành Center",
        shortLabel: "Bến Thành",
        description: "View of the central business area and the Lê Lợi, Hàm Nghi and Trần Hưng Đạo boulevards",
      },
      thuthiem: {
        label: "View from Thủ Thiêm",
        shortLabel: "Thủ Thiêm",
        description: "From the east bank, look across at the full District 1 skyline",
      },
      "street-walk": {
        label: "Street Walk",
        shortLabel: "Walk",
        description: "First-person view to walk the streets of Sài Gòn with the shared character",
      },
    },
    hint: "Drag with the left mouse button to rotate · Right mouse button to pan · Scroll to zoom in or out",
    info: {
      title: "3D Model of Ho Chi Minh City",
      intro:
        "A 3D map at real-world scale of central <strong>Ho Chi Minh City (2025)</strong>. It includes the District 1 skyline, the Bến Nghé and Bến Thành areas, the Sài Gòn River and the Thủ Thiêm peninsula (Thủ Đức City).",
      scaleLabel: "Display area:",
      verticesLabel: "Vertex count:",
      verticesValue: "493,715 vertices",
      colorSystemLabel: "Coloring system:",
      licenseLabel: "3D license:",
      note: "All architecture colors (terracotta roof tiles, yellow colonial villa walls, reflective tower glass, the water of the Sài Gòn River) were analyzed and colored by hand, together with an algorithm that uses height and surface direction (normals).",
      close: "Close",
    },
    loading: {
      title: "Loading the 3D map of Ho Chi Minh City",
      detail: "Calculating architecture and water colors (493K vertices)...",
    },
  },
};

export default hcm;
