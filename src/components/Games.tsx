import React, { useState, useEffect } from "react";
import {
  Gamepad2,
  Plus,
  Search,
  Edit,
  Trash2,
  Check,
  X,
  Settings,
  Package,
  Users,
  Calendar,
  HardDrive,
} from "lucide-react";
import { db, storage } from "../lib/supabase";
import Swal from "sweetalert2";
import type { Game, Console, EquipmentType } from "../types";

const Games: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [consoles, setConsoles] = useState<Console[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"games" | "consoles">("games");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [selectedConsole, setSelectedConsole] = useState<string | null>(null);
  const [searchGameInConsole, setSearchGameInConsole] = useState("");
  const [expandedSection, setExpandedSection] = useState<"installed" | "notInstalled" | null>("notInstalled");
  const [selectedNotInstalledGames, setSelectedNotInstalledGames] = useState<string[]>([]);
  const [selectedInstalledGames, setSelectedInstalledGames] = useState<string[]>([]);

  // Form state for adding/editing games
  const [gameForm, setGameForm] = useState({
    title: "",
    platform: [] as string[],
    genre: [] as string[],
    developer: "",
    publisher: "",
    release_year: "",
    description: "",
    file_size_gb: "",
    cover_image_url: "",
    is_multiplayer: false,
    max_players: "",
    is_active: true,
  });

  // Available options
  const platformOptions = [
    { id: "ET006", label: "Playstation 3" },
    { id: "ET001", label: "PlayStation 4 Pro" },
    { id: "ET003", label: "PlayStation 4 Slim" },
    { id: "ET002", label: "PlayStation 5" },
  ];

  const genreOptions = [
    "Action",
    "Adventure",
    "RPG",
    "Strategy",
    "Sports",
    "Racing",
    "Fighting",
    "Horror",
    "Other",
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [gamesData, consolesData, equipmentTypesData] = await Promise.all([
        db.games.getAll(),
        db.consoles.getAll(),
        db.equipmentTypes.getActive(),
      ]);

      setGames(gamesData || []);
      setConsoles(consolesData || []);
      setEquipmentTypes(equipmentTypesData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      Swal.fire("Error", "Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setGameForm({
      title: "",
      platform: [],
      genre: [],
      developer: "",
      publisher: "",
      release_year: "",
      description: "",
      file_size_gb: "",
      cover_image_url: "",
      is_multiplayer: false,
      max_players: "",
      is_active: true,
    });
  };

  const handleSubmitGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gameForm.title.trim()) {
      Swal.fire("Error", "Game title is required", "error");
      return;
    }

    if (gameForm.platform.length === 0) {
      Swal.fire("Error", "At least one platform must be selected", "error");
      return;
    }

    try {
      const gameData = {
        ...gameForm,
        release_year: gameForm.release_year
          ? parseInt(gameForm.release_year)
          : undefined,
        file_size_gb: gameForm.file_size_gb
          ? parseFloat(gameForm.file_size_gb)
          : undefined,
        max_players: gameForm.max_players
          ? parseInt(gameForm.max_players)
          : undefined,
      };

      if (editingGame) {
        await db.games.update(editingGame.id, gameData);
        Swal.fire("Success", "Game updated successfully", "success");
      } else {
        await db.games.create(gameData);
        Swal.fire("Success", "Game added successfully", "success");
      }

      resetForm();
      setShowAddForm(false);
      setEditingGame(null);
      loadData();
    } catch (error) {
      console.error("Error saving game:", error);
      Swal.fire("Error", "Failed to save game", "error");
    }
  };

  const handleEditGame = (game: Game) => {
    setEditingGame(game);
    setGameForm({
      title: game.title,
      platform: game.platform || [],
      genre: game.genre || [],
      developer: game.developer || "",
      publisher: game.publisher || "",
      release_year: game.release_year?.toString() || "",
      description: game.description || "",
      file_size_gb: game.file_size_gb?.toString() || "",
      //   esrbRating: game.esrbRating || "E",
      cover_image_url: game.cover_image_url || "",
      is_multiplayer: game.is_multiplayer || false,
      max_players: game.max_players?.toString() || "",
      is_active: game.is_active,
    });
    setShowAddForm(true);
  };

  const handleDeleteGame = async (gameId: string, title: string) => {
    const result = await Swal.fire({
      title: "Hapus Game",
      text: `Apakah Anda yakin ingin menghapus "${title}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Ya, hapus!",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      try {
        await db.games.delete(gameId);
        Swal.fire("Terhapus!", "Game telah berhasil dihapus.", "success");
        loadData();
      } catch (error) {
        console.error("Error deleting game:", error);
        Swal.fire("Error", "Gagal menghapus game", "error");
      }
    }
  };

  const handleAssignGame = async (consoleId: string, gameId: string, action?: 'install' | 'uninstall') => {
    try {
      if (action === 'install') {
        await db.consoles.addInstalledGame(consoleId, gameId);
      } else if (action === 'uninstall') {
        await db.consoles.removeInstalledGame(consoleId, gameId);
      } else {
        // Original logic with state checks (for single operations)
        const console = consoles.find((c) => c.id === consoleId);
        if (!console) {
          Swal.fire("Error", "Console not found", "error");
          return;
        }

        const availableGames = getAvailableGamesForConsole(console);
        const installedGames = getInstalledGamesForConsole(console);

        const isAvailable = availableGames.some((game) => game.id === gameId);
        const isInstalled = installedGames.includes(gameId);

        if (isInstalled) {
          await db.consoles.removeInstalledGame(consoleId, gameId);
        } else if (isAvailable) {
          await db.consoles.addInstalledGame(consoleId, gameId);
        } else {
          Swal.fire("Error", "Game tidak tersedia untuk console ini", "error");
          return;
        }
      }
    } catch (error) {
      console.error("Error updating game assignment:", error);
      throw error;
    }
  };

  const handleBulkAssignGames = async (
    consoleId: string,
    gameIds: string[],
    action: 'install' | 'uninstall'
  ) => {
    try {
      // Must run sequentially - parallel (Promise.all) causes race condition
      // because each db call reads the same initial array state before any write completes
      for (const gameId of gameIds) {
        if (action === 'install') {
          await db.consoles.addInstalledGame(consoleId, gameId);
        } else {
          await db.consoles.removeInstalledGame(consoleId, gameId);
        }
      }
      await loadData();
      Swal.fire(
        "Berhasil",
        `${gameIds.length} game berhasil diproses`,
        "success"
      );
    } catch (error) {
      console.error("Error bulk assigning games:", error);
      Swal.fire("Error", "Gagal memproses games", "error");
    }
  };

  const getPlatformLabel = (platformId: string) => {
    const platform = platformOptions.find((p) => p.id === platformId);
    return platform ? platform.label : platformId;
  };

  const platformToEquipmentType = {
    ps3: "ET006",
    ps4_pro: "ET001",
    ps4_slim: "ET003",
    ps5: "ET002",
  };

  const getAvailableGamesForConsole = (console: Console) => {
    if (!console.equipment_type_id) return [];

    return games.filter(
      (game) =>
        game.is_active && game.platform?.includes(console.equipment_type_id)
    );
  };

  const getInstalledGamesForConsole = (console: Console) => {
    return console.installed_games || [];
  };

  const getConsoleGames = (consoleId: string) => {
    const console = consoles.find((c) => c.id === consoleId);
    if (!console) return { installed: [], available: [] };

    return {
      installed: getInstalledGamesForConsole(console),
      available: getAvailableGamesForConsole(console),
    };
  };

  const filteredGames = games.filter((game) => {
    const matchesSearch =
      game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.developer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.publisher?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlatform =
      selectedPlatform === "all" || game.platform.includes(selectedPlatform);
    const matchesGenre =
      selectedGenre === "all" || game.genre.includes(selectedGenre);

    return matchesSearch && matchesPlatform && matchesGenre && game.is_active;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Master Game Management
          </h1>
          <p className="text-gray-600 mt-1">
            Kelola koleksi game dan distribusinya ke console
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              setViewMode(viewMode === "games" ? "consoles" : "games")
            }
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Settings className="h-4 w-4" />
            {viewMode === "games" ? "View Consoles" : "View Games"}
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
              setEditingGame(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Game
          </button>
        </div>
      </div>

      {/* View Toggle and Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("games")}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === "games"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Game Library ({games.length})
              </button>
              <button
                onClick={() => setViewMode("consoles")}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === "consoles"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Console ({consoles.length})
              </button>
            </div>
          </div>

          {viewMode === "games" && (
            <div className="flex gap-4 items-center">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Platforms</option>
                {platformOptions.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Genres</option>
                {genreOptions.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Game Form Modal*/}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  {editingGame ? "Edit Game" : "Add New Game"}
                </h2>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingGame(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <form onSubmit={handleSubmitGame} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Game Title *
                    </label>
                    <input
                      type="text"
                      value={gameForm.title}
                      onChange={(e) =>
                        setGameForm({ ...gameForm, title: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Developer
                    </label>
                    <input
                      type="text"
                      value={gameForm.developer}
                      onChange={(e) =>
                        setGameForm({ ...gameForm, developer: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Publisher
                    </label>
                    <input
                      type="text"
                      value={gameForm.publisher}
                      onChange={(e) =>
                        setGameForm({ ...gameForm, publisher: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Release Year
                    </label>
                    <input
                      type="number"
                      value={gameForm.release_year}
                      onChange={(e) =>
                        setGameForm({
                          ...gameForm,
                          release_year: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1950"
                      max={new Date().getFullYear() + 1}
                    />
                  </div>

                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ESRB Rating
                    </label>
                    <select
                      value={gameForm.esrbRating}
                      onChange={(e) =>
                        setGameForm({
                          ...gameForm,
                          esrbRating: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="E">E - Everyone</option>
                      <option value="E10+">E10+ - Everyone 10+</option>
                      <option value="T">T - Teen</option>
                      <option value="M">M - Mature</option>
                      <option value="A">A - Adult Only</option>
                      <option value="RP">RP - Rating Pending</option>
                    </select>
                  </div> */}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      File Size (GB)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={gameForm.file_size_gb}
                      onChange={(e) =>
                        setGameForm({
                          ...gameForm,
                          file_size_gb: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Platforms */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Platforms *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {platformOptions.map((platform) => (
                      <label key={platform.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={gameForm.platform.includes(platform.id)}
                          onChange={(e) => {
                            const updatedPlatforms = e.target.checked
                              ? [...gameForm.platform, platform.id]
                              : gameForm.platform.filter(
                                  (p) => p !== platform.id
                                );
                            setGameForm({
                              ...gameForm,
                              platform: updatedPlatforms,
                            });
                          }}
                          className="mr-2"
                        />
                        {platform.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Genres */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Genres
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {genreOptions.map((genre) => (
                      <label key={genre} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={gameForm.genre.includes(genre)}
                          onChange={(e) => {
                            const updatedGenres = e.target.checked
                              ? [...gameForm.genre, genre]
                              : gameForm.genre.filter((g) => g !== genre);
                            setGameForm({ ...gameForm, genre: updatedGenres });
                          }}
                          className="mr-2"
                        />
                        {genre}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Multiplayer options */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isMultiplayer"
                      checked={gameForm.is_multiplayer}
                      onChange={(e) =>
                        setGameForm({
                          ...gameForm,
                          is_multiplayer: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <label
                      htmlFor="isMultiplayer"
                      className="text-sm font-medium text-gray-700"
                    >
                      Multiplayer Game
                    </label>
                  </div>

                  {gameForm.is_multiplayer && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Players
                      </label>
                      <input
                        type="number"
                        value={gameForm.max_players}
                        onChange={(e) =>
                          setGameForm({
                            ...gameForm,
                            max_players: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                  )}

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={gameForm.is_active}
                      onChange={(e) =>
                        setGameForm({
                          ...gameForm,
                          is_active: e.target.checked,
                        })
                      }
                      className="mr-2"
                    />
                    <label
                      htmlFor="isActive"
                      className="text-sm font-medium text-gray-700"
                    >
                      Active
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={gameForm.description}
                    onChange={(e) =>
                      setGameForm({ ...gameForm, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Game description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cover Image (Max 5MB)
                  </label>
                  <div className="space-y-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const publicUrl = await storage.uploadGameCover(
                              file,
                              editingGame?.id,
                              gameForm.cover_image_url
                            );
                            setGameForm({
                              ...gameForm,
                              cover_image_url: publicUrl,
                            });

                            Swal.fire(
                              "Success",
                              "Gambar berhasil diupload",
                              "success"
                            );
                          } catch (error) {
                            console.error("Upload error:", error);
                            Swal.fire(
                              "Error",
                              "Gagal mengupload gambar",
                              "error"
                            );
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />

                    {gameForm.cover_image_url && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {editingGame ? "Current Image:" : "Uploaded Image:"}
                        </p>
                        <img
                          src={gameForm.cover_image_url}
                          alt="Cover preview"
                          className="max-w-xs max-h-48 object-contain rounded-lg border border-gray-200 bg-gray-50 p-1"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingGame(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingGame ? "Update Game" : "Add Game"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Games View */}
      {viewMode === "games" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              className="bg-white rounded-lg shadow-sm border overflow-hidden"
            >
              {game.cover_image_url ? (
                <div className="aspect-video w-full bg-gray-100 overflow-hidden relative">
                  {/* Loading placeholder */}
                  <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>

                  <img
                    src={game.cover_image_url}
                    alt={`${game.title} cover`}
                    className="w-full h-full object-contain bg-gray-100 transition-transform duration-300"
                    loading="lazy"
                    onLoad={(e) => {
                      const placeholder = e.currentTarget
                        .previousElementSibling as HTMLElement;
                      if (placeholder) placeholder.style.display = "none";
                    }}
                    onError={(e) => {
                      const placeholder = e.currentTarget
                        .previousElementSibling as HTMLElement;
                      if (placeholder) placeholder.style.display = "none";

                      e.currentTarget.style.display = "none";
                      const container = e.currentTarget.parentElement;
                      if (container) {
                        container.innerHTML = `
                          <div class="flex items-center justify-center h-full bg-gray-100">
                            <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                          </div>
                        `;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-video w-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-12 h-12 text-blue-300 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-xs text-blue-600 font-medium">
                      No Cover Image
                    </p>
                  </div>
                </div>
              )}

              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {game.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {game.developer && `${game.developer}`}
                      {game.developer && game.release_year && " • "}
                      {game.release_year}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditGame(game)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGame(game.id, game.title)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex flex-wrap gap-1">
                    {game.platform.map((platform) => (
                      <span
                        key={platform}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {getPlatformLabel(platform)}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {game.genre.slice(0, 3).map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {genre}
                      </span>
                    ))}
                    {game.genre.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        +{game.genre.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                {game.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {game.description}
                  </p>
                )}

                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    {game.file_size_gb && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-4 w-4" />
                        {game.file_size_gb}GB
                      </span>
                    )}
                    {game.is_multiplayer && (
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Multi
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      game.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {game.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Consoles View */}
      {viewMode === "consoles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...consoles].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map((console) => {
            const consoleGamesList = getConsoleGames(console.id);
            return (
              <div
                key={console.id}
                className="bg-white rounded-lg shadow-sm border overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {console.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {console.equipment_types?.name}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        console.status === "available"
                          ? "bg-green-100 text-green-800"
                          : console.status === "rented"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {console.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Installed Games ({console.installed_games?.length || 0})
                    </h4>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {console.installed_games &&
                      console.installed_games.length > 0 ? (
                        console.installed_games.map((gameId) => {
                          const game = games.find((g) => g.id === gameId);
                          return game ? (
                            <div
                              key={gameId}
                              className="relative group"
                              title={game.title}
                            >
                              <div className="w-16 h-20 bg-gray-100 rounded border border-gray-200 overflow-hidden">
                                {game.cover_image_url ? (
                                  <img
                                    src={game.cover_image_url}
                                    alt={game.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                    <Gamepad2 className="h-6 w-6 text-gray-300" />
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  handleSingleAssignGame(console.id, game.id)
                                }
                                className="absolute -top-2 -right-2 bg-green-600 hover:bg-green-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            </div>
                          ) : null;
                        })
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No games installed
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setSelectedConsole(console.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Manage Games
                    </button>
                    <span className="text-xs text-gray-500">
                      {console.location}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Console Game Management Modal */}
      {selectedConsole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  Manage Games -{" "}
                  {consoles.find((c) => c.id === selectedConsole)?.name}
                </h2>
                <button
                  onClick={() => {
                    setSelectedConsole(null);
                    setSearchGameInConsole("");
                    setSelectedNotInstalledGames([]);
                    setSelectedInstalledGames([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari game berdasarkan judul..."
                  value={searchGameInConsole}
                  onChange={(e) => setSearchGameInConsole(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {(() => {
                const console = consoles.find((c) => c.id === selectedConsole);
                if (!console) return null;

                const availableGames = getAvailableGamesForConsole(console);
                const installedGames = getInstalledGamesForConsole(console);
                const allRelevantGames = games.filter(
                  (game) =>
                    game.is_active &&
                    (availableGames.some((g) => g.id === game.id) ||
                      installedGames.includes(game.id))
                );

                const notInstalledGames = allRelevantGames
                  .filter((game) => !installedGames.includes(game.id))
                  .filter((game) =>
                    game.title.toLowerCase().includes(searchGameInConsole.toLowerCase())
                  );

                const installedGamesList = allRelevantGames
                  .filter((game) => installedGames.includes(game.id))
                  .filter((game) =>
                    game.title.toLowerCase().includes(searchGameInConsole.toLowerCase())
                  );

                if (allRelevantGames.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <svg
                          className="mx-auto h-12 w-12"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Tidak Ada Game Tersedia
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Belum ada game yang kompatibel dengan console ini atau
                        sudah terinstall.
                      </p>
                    </div>
                  );
                }

                if (notInstalledGames.length === 0 && installedGamesList.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <svg
                          className="mx-auto h-12 w-12"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Game Tidak Ditemukan
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Tidak ada game dengan judul "{searchGameInConsole}"
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Belum Diinstall Accordion */}
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() =>
                          setExpandedSection(
                            expandedSection === "notInstalled" ? null : "notInstalled"
                          )
                        }
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 flex items-center justify-center transition-transform ${
                              expandedSection === "notInstalled" ? "rotate-90" : ""
                            }`}
                          >
                            <svg
                              className="w-5 h-5 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                          <h3 className="font-semibold text-gray-900">
                            Belum Diinstall
                          </h3>
                          <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                            {notInstalledGames.length}
                          </span>
                        </div>
                      </button>

                      {expandedSection === "notInstalled" && (
                        <div className="px-6 py-4 border-t bg-gray-50">
                          {notInstalledGames.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                              Semua game sudah diinstall
                            </p>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-2">
                                {notInstalledGames.map((game) => (
                                  <div
                                    key={game.id}
                                    className="relative group"
                                    title={game.title}
                                  >
                                    <div className="rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow bg-white w-16 h-20 flex items-center justify-center">
                                      {game.cover_image_url ? (
                                        <img
                                          src={game.cover_image_url}
                                          alt={game.title}
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-50 to-blue-100">
                                          <Gamepad2 className="h-5 w-5 text-blue-300" />
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={selectedNotInstalledGames.includes(
                                        game.id
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedNotInstalledGames([
                                            ...selectedNotInstalledGames,
                                            game.id,
                                          ]);
                                        } else {
                                          setSelectedNotInstalledGames(
                                            selectedNotInstalledGames.filter(
                                              (id) => id !== game.id
                                            )
                                          );
                                        }
                                      }}
                                      className="absolute -bottom-2 -right-2 w-4 h-4 rounded border-2 border-blue-600 bg-white cursor-pointer"
                                    />
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={async () => {
                                  if (selectedNotInstalledGames.length === 0) {
                                    Swal.fire(
                                      "Info",
                                      "Pilih game yang ingin diinstall",
                                      "info"
                                    );
                                    return;
                                  }
                                  await handleBulkAssignGames(
                                    selectedConsole!,
                                    selectedNotInstalledGames,
                                    'install'
                                  );
                                  setSelectedNotInstalledGames([]);
                                }}
                                disabled={selectedNotInstalledGames.length === 0}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                              >
                                Install ({selectedNotInstalledGames.length})
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sudah Diinstall Accordion */}
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() =>
                          setExpandedSection(
                            expandedSection === "installed" ? null : "installed"
                          )
                        }
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 flex items-center justify-center transition-transform ${
                              expandedSection === "installed" ? "rotate-90" : ""
                            }`}
                          >
                            <svg
                              className="w-5 h-5 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                          <h3 className="font-semibold text-gray-900">
                            Sudah Diinstall
                          </h3>
                          <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                            {installedGamesList.length}
                          </span>
                        </div>
                      </button>

                      {expandedSection === "installed" && (
                        <div className="px-6 py-4 border-t bg-gray-50">
                          {installedGamesList.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                              Belum ada game yang diinstall
                            </p>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-2">
                                {installedGamesList.map((game) => (
                                  <div
                                    key={game.id}
                                    className="relative group"
                                    title={game.title}
                                  >
                                    <div className="rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow bg-white w-16 h-20 flex items-center justify-center">
                                      {game.cover_image_url ? (
                                        <img
                                          src={game.cover_image_url}
                                          alt={game.title}
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            e.currentTarget.style.display = "none";
                                          }}
                                        />
                                      ) : (
                                        <div className="flex items-center justify-center h-full bg-gradient-to-br from-green-50 to-green-100">
                                          <Gamepad2 className="h-5 w-5 text-green-300" />
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={selectedInstalledGames.includes(
                                        game.id
                                      )}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedInstalledGames([
                                            ...selectedInstalledGames,
                                            game.id,
                                          ]);
                                        } else {
                                          setSelectedInstalledGames(
                                            selectedInstalledGames.filter(
                                              (id) => id !== game.id
                                            )
                                          );
                                        }
                                      }}
                                      className="absolute -bottom-2 -right-2 w-4 h-4 rounded border-2 border-green-600 bg-white cursor-pointer"
                                    />
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={async () => {
                                  if (selectedInstalledGames.length === 0) {
                                    Swal.fire(
                                      "Info",
                                      "Pilih game yang ingin dihapus",
                                      "info"
                                    );
                                    return;
                                  }
                                  await handleBulkAssignGames(
                                    selectedConsole!,
                                    selectedInstalledGames,
                                    'uninstall'
                                  );
                                  setSelectedInstalledGames([]);
                                }}
                                disabled={selectedInstalledGames.length === 0}
                                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                              >
                                Uninstall ({selectedInstalledGames.length})
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Games;
