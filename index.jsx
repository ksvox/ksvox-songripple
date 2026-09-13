'use client';

import React, { useState, useEffect, useRef } from 'react';

// Fallback silhouette image SVG encoded as data URL
const DUMMY_ARTIST_PHOTO = "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#E2E8F0"/>
        <circle cx="50" cy="38" r="18" fill="#94A3B8"/>
        <path d="M18 92 C18 66 34 56 50 56 C66 56 82 66 82 92 Z" fill="#94A3B8"/>
    </svg>
`);

// YouTube Playlist configuration for PURE VOX carousel
const INITIAL_YT_PLAYLISTS = [
    { id: "PLtNoF8CCU5z2tHNoyrlwh_zJKixwtm8bM", fallback: "PURE VOX - A Cappella Hits Vol.1", title: "読み込み中..." },
    { id: "PLtNoF8CCU5z20bTPhDlk-LEDZgTBbYCKG", fallback: "PURE VOX - Western Pop Covers", title: "読み込み中..." },
    { id: "PLtNoF8CCU5z3v1-Md3ohxfo7aFT-K7ZdL", fallback: "PURE VOX - Vocal Harmonies", title: "読み込み中..." },
    { id: "PLtNoF8CCU5z2XFIGkRRw4ooJdrpjwrfWH", fallback: "PURE VOX - Acoustic & A Cappella", title: "読み込み中..." },
    { id: "PLtNoF8CCU5z1YJjkKMQs5QpAbyE-uf8vK", fallback: "PURE VOX - Classic Covers Collection", title: "読み込み中..." },
    { id: "PLtNoF8CCU5z2UVK7cANQml6KB7_RMQ8Wy", fallback: "PURE VOX - Live & Special Performance", title: "読み込み中..." }
];

export default function SongRippleApp() {
    // Form Inputs & Search States
    const [artist, setArtist] = useState('');
    const [song, setSong] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('「楽曲インサイト」を解析中...');
    const [errorMsg, setErrorMsg] = useState(null);
    const [resultsData, setResultsData] = useState(null);
    const [lastSearchQuery, setLastSearchQuery] = useState({ artist: '', song: '' });
    
    // Preset Tag Sample List State
    const [sampleTags, setSampleTags] = useState([
        { artist: 'Bruno Mars', song: 'Just the Way You Are' },
        { artist: 'Taylor Swift', song: 'Cruel Summer' },
        { artist: 'Billie Eilish', song: 'BIRDS OF A FEATHER' },
        { artist: 'Official髭男dism', song: 'Subtitle' }
    ]);
    const [isRefreshingTrending, setIsRefreshingTrending] = useState(false);

    // Spotify Carousel States
    const [spotifyIndex, setSpotifyIndex] = useState(0);
    const [isSpotifyPaused, setIsSpotifyPaused] = useState(false);
    const [isSpotifyHovered, setIsSpotifyHovered] = useState(false);

    // YouTube Carousel States
    const [ytIndex, setYtIndex] = useState(0);
    const [isYtPaused, setIsYtPaused] = useState(false);
    const [isYtHovered, setIsYtHovered] = useState(false);
    const [ytPlaylists, setYtPlaylists] = useState(INITIAL_YT_PLAYLISTS);

    // Modal State
    const [modalPhotoUrl, setModalPhotoUrl] = useState(null);

    useEffect(() => {
        document.title = "Song Ripple - 音楽情報＆歌唱インサイト検索";

        const links = [
            { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' },
            { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
            { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'true' },
            { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&family=Poppins:wght@600;700;800&display=swap' }
        ];

        links.forEach(attrs => {
            if (!document.querySelector(`link[href="${attrs.href}"]`)) {
                const link = document.createElement('link');
                Object.entries(attrs).forEach(([key, val]) => link.setAttribute(key, val));
                document.head.appendChild(link);
            }
        });
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!isYtPaused && !isYtHovered) {
                setYtIndex(prev => (prev + 1) % 6);
            }
        }, 3500);
        return () => clearInterval(timer);
    }, [isYtPaused, isYtHovered]);

    useEffect(() => {
        const fetchPlaylistTitles = async () => {
            const updated = await Promise.all(ytPlaylists.map(async (item) => {
                try {
                    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/playlist?list=${item.id}&format=json`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.title) {
                            return { ...item, title: data.title };
                        }
                    }
                } catch (e) {
                    console.warn(`oEmbed fetch failed for ${item.id}`);
                }
                return { ...item, title: item.fallback };
            }));
            setYtPlaylists(updated);
        };
        fetchPlaylistTitles();
    }, []);

    const executeSearch = async (targetArtist, targetSong) => {
        if (!targetArtist || !targetSong) return;

        setIsLoading(true);
        setErrorMsg(null);
        setResultsData(null);
        setLoadingMsg(`「${targetArtist} - ${targetSong}」を解析中...`);

        try {
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'search', artist: targetArtist, song: targetSong })
            });

            const resJson = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(resJson.error || `APIエラー (Status: ${res.status})`);
            }

            const candidate = resJson.candidates?.[0];
            if (!candidate) throw new Error("Geminiからの応答データが空でした。");

            const parts = candidate.content?.parts || [];
            let rawText = parts.map(p => p.text || '').join('');
            if (!rawText) throw new Error("解析データテキストの取得に失敗しました。");

            let cleanJson = rawText.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
            const firstBrace = cleanJson.indexOf('{');
            const lastBrace = cleanJson.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
            }

            const parsed = JSON.parse(cleanJson);
            setResultsData(parsed);
            setLastSearchQuery({ artist: targetArtist, song: targetSong });
        } catch (err) {
            console.error("Search API Error:", err);
            // Fallback mock data for preview environments
            if (typeof window !== 'undefined' && (window.location.protocol.startsWith('blob') || window.location.origin === 'null')) {
                const mock = getMockData(targetArtist, targetSong);
                setResultsData(mock);
                setLastSearchQuery({ artist: targetArtist, song: targetSong });
            } else {
                setErrorMsg(err.message || "リアルタイム解析処理中にエラーが発生しました。");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        executeSearch(artist, song);
    };

    const handleSampleClick = (sampleArtist, sampleSong) => {
        setArtist(sampleArtist);
        setSong(sampleSong);
        executeSearch(sampleArtist, sampleSong);
    };

    const fetchTrendingSamples = async () => {
        setIsRefreshingTrending(true);
        try {
            const res = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'trending' })
            });

            if (res.ok) {
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const items = JSON.parse(clean);
                    if (Array.isArray(items) && items.length >= 4) {
                        setSampleTags(items.slice(0, 4));
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn("Trending fetch failed, keeping presets.", err);
        } finally {
            setIsRefreshingTrending(false);
        }
    };

    const downloadResultsAsText = () => {
        if (!resultsData) return;
        const data = resultsData;
        const { artist: qArtist, song: qSong } = lastSearchQuery;

        const lines = [
            `■ ${qArtist} － ${qSong}`,
            `（Song Ripple で検索した情報）`,
            '',
            '【アーティスト情報】',
            `出身地・活動拠点: ${data.artist?.origin || '情報なし'}`,
            `年齢 / キャリア: ${data.artist?.age || '情報なし'}`,
            `経歴・バイオグラフィー: ${data.artist?.bio || '情報なし'}`,
            `代表曲: ${(data.artist?.topSongs || []).join(' / ') || '情報なし'}`,
            '',
            '【楽曲情報・解析】',
            `Key（調）: ${data.song?.key || '不明'}`,
            `BPM（テンポ）: ${data.song?.bpm || '不明'}`,
            `リリース: ${data.song?.release || '不明'}`,
            `ジャンル・サウンドの特徴: ${data.song?.features || '情報なし'}`,
            `歌唱の特徴・発声アドバイス: ${data.song?.vocalFeatures || '情報なし'}`,
            '',
            '【感性・構造が近い類似曲】',
            ...(data.similarSongs || []).map((sim, i) => `${i + 1}. ${sim.artist} - ${sim.song}\n   理由: ${sim.reason}`)
        ];

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const safeName = `${qArtist}_${qSong}`.replace(/[\\/:*?"<>|]/g, '_');

        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getMockData = (a, s) => {
        const query = `${a} ${s}`.toLowerCase();
        let videoId = 'LjhCEhWiKXk';
        let platform = 'youtube';

        if (query.includes('taylor swift')) videoId = 'ic8j13piUrQ';
        else if (query.includes('billie eilish')) videoId = 'd5gf9dXb4ik';
        else if (query.includes('official')) videoId = 'hN5MBlGv2Ac';

        return {
            video: { platform, videoId, type: "公式MV" },
            artist: {
                origin: "国内外で活躍中",
                age: "人気アーティスト",
                bio: `${a}は独自のボーカル表現と魅力的な楽曲構築で高い人気を博しているアーティストです。`,
                topSongs: [s, "代表ヒット 1", "代表ヒット 2"]
            },
            song: {
                release: "話題作",
                key: "G Major",
                bpm: "120 BPM",
                features: `「${s}」は耳に残るサビと洗練されたメロディラインが魅力の楽曲です。`,
                vocalFeatures: "アタック感のある発声とブレスコントロールが重要なポイントです。"
            },
            similarSongs: [
                { artist: "Bruno Mars", song: "Just the Way You Are", reason: "フックのあるメロディと声の切り替えが似ているため。" },
                { artist: "Official髭男dism", song: "Pretender", reason: "感情豊かなボーカルラインと構成の共通点。" },
                { artist: "Taylor Swift", song: "Cruel Summer", reason: "キャッチーなサビとサウンドのノリが近い。" }
            ]
        };
    };

    const videoInfo = resultsData?.video || (resultsData?.youtube ? {
        platform: resultsData.youtube.videoId ? 'youtube' : null,
        videoId: resultsData.youtube.videoId,
        type: resultsData.youtube.type
    } : null);

    return (
        <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between selection:bg-red-600 selection:text-white font-sans">
            {/* Header / Search Form */}
            <header className="relative bg-black pt-8 pb-10 px-4 sm:px-6 lg:px-8 border-b border-gray-900 shadow-2xl">
                <div className="max-w-5xl mx-auto">
                    
                    {/* Brand Title Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 bg-black p-1 rounded-2xl border border-red-500/40 shadow-xl shadow-red-950/60 flex items-center justify-center overflow-hidden">
                                <img 
                                    src="/logo.png" 
                                    alt="Song Ripple Logo" 
                                    className="w-full h-full object-contain rounded-xl relative z-10"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const svg = document.getElementById('nextSvgLogo');
                                        if (svg) svg.classList.remove('hidden');
                                    }}
                                />
                                <svg id="nextSvgLogo" className="hidden w-full h-full relative z-10" viewBox="0 0 100 100" fill="none">
                                    <defs>
                                        <linearGradient id="songGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#FF4D4D" />
                                            <stop offset="50%" stopColor="#E52E2E" />
                                            <stop offset="100%" stopColor="#990000" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx="50" cy="50" r="44" stroke="url(#songGrad)" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.4"/>
                                    <circle cx="50" cy="50" r="34" stroke="url(#songGrad)" strokeWidth="2" opacity="0.75"/>
                                    <circle cx="50" cy="50" r="22" fill="#E52E2E" opacity="0.12"/>
                                    <path d="M30 58V42" stroke="url(#songGrad)" strokeWidth="4" strokeLinecap="round"/>
                                    <path d="M40 68V32" stroke="url(#songGrad)" strokeWidth="4.5" strokeLinecap="round"/>
                                    <path d="M50 76V24" stroke="url(#songGrad)" strokeWidth="5" strokeLinecap="round"/>
                                    <path d="M60 65V35" stroke="url(#songGrad)" strokeWidth="4.5" strokeLinecap="round"/>
                                    <path d="M70 55V45" stroke="url(#songGrad)" strokeWidth="4" strokeLinecap="round"/>
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-poppins text-white flex items-center gap-2">
                                    Song Ripple
                                </h1>
                                <p className="text-xs sm:text-sm text-gray-400 font-light mt-0.5">音楽を深掘りするインサイト・サーチ</p>
                            </div>
                        </div>
                    </div>

                    {/* Main Search Card */}
                    <div className="bg-slate-950/90 backdrop-blur-md p-5 sm:p-7 rounded-2xl shadow-2xl relative border border-gray-800 overflow-hidden">
                        
                        {/* Glow Lights */}
                        <div className="absolute -top-20 -left-20 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-red-600/20 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="relative z-10 mb-4 flex items-center justify-between border-b border-gray-800 pb-2.5">
                            <p className="text-xs sm:text-sm font-semibold text-red-500 flex items-center gap-2">
                                <i className="fa-solid fa-circle-info"></i> アーティスト名と曲名を入力してください
                            </p>
                            <span className="text-[11px] text-gray-400">洋楽・邦楽対応</span>
                        </div>

                        {/* Search Input Form */}
                        <form onSubmit={handleFormSubmit} className="relative z-10 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                                        <i className="fa-solid fa-user-ninja text-red-500 mr-1.5"></i>アーティスト名
                                    </label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={artist}
                                        onChange={(e) => setArtist(e.target.value)}
                                        placeholder="例: Bruno Mars, Taylor Swift, Vaundy" 
                                        className="w-full bg-gray-900/90 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition placeholder-gray-500 shadow-inner"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                                        <i className="fa-solid fa-music text-red-500 mr-1.5"></i>曲名
                                    </label>
                                    <input 
                                        type="text" 
                                        required 
                                        value={song}
                                        onChange={(e) => setSong(e.target.value)}
                                        placeholder="例: Just the Way You Are, Cruel Summer, 怪獣の花唄" 
                                        className="w-full bg-gray-900/90 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition placeholder-gray-500 shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold py-3.5 px-6 rounded-xl transition duration-200 transform hover:-translate-y-0.5 shadow-lg shadow-red-950/50 flex items-center justify-center space-x-2 text-base disabled:opacity-50"
                                >
                                    <i className="fa-solid fa-magnifying-glass"></i>
                                    <span>楽曲インサイトを解析・検索</span>
                                </button>
                            </div>
                        </form>

                        {/* Quick Preset Buttons */}
                        <div className="relative z-10 mt-4 pt-3 border-t border-gray-800/80 flex items-center flex-wrap gap-2 text-xs text-gray-400">
                            <span className="font-medium text-gray-400"><i className="fa-solid fa-bolt text-yellow-500 mr-1"></i>サンプル検索:</span>
                            <div className="flex items-center flex-wrap gap-2">
                                {sampleTags.map((sample, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleSampleClick(sample.artist, sample.song)}
                                        className="bg-gray-800/60 hover:bg-red-500/20 hover:text-red-400 text-gray-300 px-2.5 py-1 rounded-md transition border border-gray-700/50"
                                    >
                                        {sample.artist} - {sample.song}
                                    </button>
                                ))}
                            </div>
                            <button 
                                onClick={fetchTrendingSamples}
                                disabled={isRefreshingTrending}
                                title="ネット上の話題曲を自動更新" 
                                className="ml-auto text-xs bg-gray-800 hover:bg-gray-700 text-red-400 px-2.5 py-1 rounded-md transition border border-gray-700 flex items-center gap-1 disabled:opacity-50"
                            >
                                <i className={`fa-solid fa-arrows-rotate text-[10px] ${isRefreshingTrending ? 'animate-spin' : ''}`}></i> トレンド自動取得
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-grow bg-slate-100 text-slate-900 py-10 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">

                    {/* API Error Notification Banner */}
                    {errorMsg && (
                        <div className="mb-6 bg-red-50 border border-red-300 text-red-900 p-5 rounded-2xl shadow-sm">
                            <div className="flex items-start space-x-3">
                                <i className="fa-solid fa-triangle-exclamation text-red-600 text-2xl flex-shrink-0 mt-0.5"></i>
                                <div className="space-y-1">
                                    <h3 className="font-bold text-base text-red-600">検索処理中にエラーが発生しました</h3>
                                    <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="text-center py-20 px-4 bg-white rounded-3xl border border-gray-200 shadow-sm space-y-6">
                            <div className="inline-block relative">
                                <div className="w-20 h-20 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                                <i className="fa-solid fa-waveform absolute inset-0 m-auto text-red-600 text-xl flex items-center justify-center"></i>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{loadingMsg}</h3>
                                <p className="text-xs text-gray-500 mt-2">海外・国内の最新データベース、楽曲構造(Key/BPM)、歌唱ニュアンスを分析し日本語に集約中</p>
                            </div>
                        </div>
                    )}

                    {/* Default Welcome State */}
                    {!isLoading && !resultsData && !errorMsg && (
                        <div className="text-center py-16 px-6 bg-white rounded-3xl border border-gray-200 shadow-sm space-y-4">
                            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
                                <i className="fa-solid fa-compact-disc animate-spin-slow"></i>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800">Song Ripple！より音楽を深く知ろう♪</h2>
                            <p className="text-xs sm:text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
                                AIがWeb上のデータを収集・分析し、アーティストと楽曲の詳細を即座にお届けします。
                            </p>
                        </div>
                    )}

                    {!isLoading && resultsData && (
                        <div className="space-y-8">
                            
                            {/* 1. Video Player Card */}
                            <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md">
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <i className={`fa-solid ${videoInfo?.platform === 'vimeo' ? 'fa-brands fa-vimeo-v text-blue-500' : 'fa-brands fa-youtube text-red-600'} text-xl`}></i>
                                        <span>関連動画</span>
                                    </h2>
                                    <span className={`text-xs ${videoInfo?.platform === 'vimeo' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'} px-3 py-1 rounded-full font-semibold`}>
                                        {videoInfo?.type || '公式動画'}
                                    </span>
                                </div>

                                {videoInfo?.videoId ? (
                                    <>
                                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-inner relative">
                                            {videoInfo.platform === 'vimeo' ? (
                                                <iframe 
                                                    src={`https://player.vimeo.com/video/${videoInfo.videoId}?autoplay=0&autopause=1`} 
                                                    className="w-full h-full" 
                                                    frameBorder="0" 
                                                    allow="autoplay; fullscreen; picture-in-picture" 
                                                    allowFullScreen
                                                />
                                            ) : (
                                                <iframe 
                                                    className="w-full h-full" 
                                                    src={`https://www.youtube.com/embed/${videoInfo.videoId}?rel=0`} 
                                                    title="YouTube video player" 
                                                    frameBorder="0" 
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                                    allowFullScreen
                                                />
                                            )}
                                        </div>

                                        <div className="mt-3 text-right">
                                            {videoInfo.platform === 'vimeo' ? (
                                                <a href={`https://vimeo.com/${videoInfo.videoId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-bold">
                                                    <span>Vimeoで直接開いて見る</span>
                                                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                                </a>
                                            ) : (
                                                <a href={`https://www.youtube.com/watch?v=${videoInfo.videoId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:underline font-bold">
                                                    <span>YouTubeで直接開いて見る</span>
                                                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                                </a>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-xl text-center">
                                        <i className="fa-solid fa-triangle-exclamation text-2xl text-amber-500 mb-2"></i>
                                        <p className="font-bold text-base">適切な動画が見つかりませんでした</p>
                                        <p className="text-xs text-amber-700 mt-1">公式MVまたは本人歌唱動画をVimeoやYouTubeで検索してお試しください。</p>
                                    </div>
                                )}
                            </section>

                            {/* 2. Grid: Artist Profile & Track Technical Analytics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                
                                {/* Artist Card */}
                                <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-5">
                                    <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
                                        <div 
                                            className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center cursor-pointer active:opacity-70 transition"
                                            onClick={() => setModalPhotoUrl(resultsData.photo?.imageUrl || DUMMY_ARTIST_PHOTO)}
                                            title="タップして拡大表示"
                                        >
                                            <img 
                                                src={resultsData.photo?.imageUrl || DUMMY_ARTIST_PHOTO} 
                                                alt="アーティスト写真"
                                                className="w-full h-full object-contain"
                                                onError={(e) => { e.currentTarget.src = DUMMY_ARTIST_PHOTO; }}
                                            />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">{lastSearchQuery.artist}</h2>
                                            <p className="text-xs text-gray-500">
                                                Artist Profile {resultsData.photo?.source ? `（写真: ${resultsData.photo.source}）` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                                        <div>
                                            <span className="text-gray-400 block font-medium">出身地・活動拠点</span>
                                            <span className="font-bold text-gray-800 text-sm">{resultsData.artist?.origin || '--'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block font-medium">年齢 / キャリア</span>
                                            <span className="font-bold text-gray-800 text-sm">{resultsData.artist?.age || '--'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">経歴・バイオグラフィー</h3>
                                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                                            {resultsData.artist?.bio || '情報なし'}
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">代表曲</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {(resultsData.artist?.topSongs || []).map((songName, i) => (
                                                <span key={i} className="bg-slate-100 border border-slate-200 text-gray-800 text-xs px-2.5 py-1 rounded-lg font-medium">
                                                    {songName}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* Track Technical Info Card */}
                                <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md space-y-5">
                                    <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                                            <i className="fa-solid fa-sliders"></i>
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">{lastSearchQuery.song}</h2>
                                            <p className="text-xs text-gray-500">Song Analytics</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="bg-red-50/80 border border-red-100 p-3 rounded-xl">
                                            <span className="text-[10px] text-red-600 font-bold block uppercase">Key（調）</span>
                                            <span className="text-base font-extrabold text-red-600">{resultsData.song?.key || '不明'}</span>
                                        </div>
                                        <div className="bg-red-50/80 border border-red-100 p-3 rounded-xl">
                                            <span className="text-[10px] text-red-600 font-bold block uppercase">BPM（テンポ）</span>
                                            <span className="text-base font-extrabold text-red-600">{resultsData.song?.bpm || '不明'}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                                            <span className="text-[10px] text-gray-500 font-bold block uppercase">リリース</span>
                                            <span className="text-xs font-bold text-gray-800">{resultsData.song?.release || '不明'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                            <i className="fa-solid fa-drum text-red-600 mr-1"></i> ジャンル・サウンドの特徴
                                        </h3>
                                        <p className="text-xs sm:text-sm text-gray-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            {resultsData.song?.features || '解析情報なし'}
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                            <i className="fa-solid fa-microphone text-red-600 mr-1"></i> 歌唱の特徴・発声アドバイス
                                        </h3>
                                        <p className="text-xs sm:text-sm text-gray-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            {resultsData.song?.vocalFeatures || '歌唱情報なし'}
                                        </p>
                                    </div>
                                </section>
                            </div>

                            {/* 3. Similar Songs Recommendations */}
                            <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md">
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                                            <i className="fa-solid fa-layer-group"></i>
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">感性・構造が近い類似曲</h2>
                                            <p className="text-xs text-gray-500">テンポ / 曲調 / 歌唱難易度・世界観からAIが選出</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(resultsData.similarSongs || []).map((sim, index) => (
                                        <div key={index} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-red-400 transition shadow-sm">
                                            <div>
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <i className="fa-solid fa-compact-disc text-red-600"></i>
                                                    <h4 className="font-bold text-gray-900 text-sm">{sim.song}</h4>
                                                </div>
                                                <p className="text-xs font-semibold text-gray-600 mb-2">by {sim.artist}</p>
                                                <p className="text-xs text-gray-600 leading-relaxed bg-white p-2.5 rounded-lg border border-gray-100">{sim.reason}</p>
                                            </div>
                                            <button 
                                                onClick={() => handleSampleClick(sim.artist, sim.song)}
                                                className="mt-3 text-xs text-red-600 hover:underline font-bold text-right block"
                                            >
                                                この曲を再検索 <i className="fa-solid fa-arrow-right"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Export / Download Toolbar */}
                            <div className="flex items-center justify-center sm:justify-end">
                                <button 
                                    onClick={downloadResultsAsText}
                                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-gray-800 hover:bg-gray-700 px-4 py-2.5 rounded-xl transition border border-gray-700 shadow"
                                >
                                    <i className="fa-solid fa-file-arrow-down"></i>
                                    <span>この結果をテキストで保存</span>
                                </button>
                            </div>

                        </div>
                    )}
                </div>
            </main>

            <section className="bg-black py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-900">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                            <h2 className="text-xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2">
                                <i className="fa-brands fa-spotify text-green-500 text-2xl"></i>
                                K's VOXのお勧めプレイリスト
                            </h2>
                        </div>

                        <div className="flex items-center space-x-3">
                            <button 
                                onClick={() => setSpotifyIndex(prev => (prev - 1 + 5) % 5)}
                                className="w-10 h-10 rounded-full bg-gray-900 hover:bg-red-600 text-white flex items-center justify-center transition shadow-lg border border-gray-800"
                            >
                                <i className="fa-solid fa-chevron-left text-sm"></i>
                            </button>
                            <button 
                                onClick={() => setIsSpotifyPaused(!isSpotifyPaused)}
                                className="px-3.5 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 text-xs text-gray-300 transition border border-gray-800 flex items-center gap-1.5"
                            >
                                <i className={`fa-solid ${isSpotifyPaused ? 'fa-play text-green-500' : 'fa-pause text-red-500'}`}></i>
                                <span>{isSpotifyPaused ? '再生' : '一時停止'}</span>
                            </button>
                            <button 
                                onClick={() => setSpotifyIndex(prev => (prev + 1) % 5)}
                                className="w-10 h-10 rounded-full bg-gray-900 hover:bg-red-600 text-white flex items-center justify-center transition shadow-lg border border-gray-800"
                            >
                                <i className="fa-solid fa-chevron-right text-sm"></i>
                            </button>
                        </div>
                    </div>

                    <div 
                        className="relative overflow-hidden rounded-2xl bg-black border border-gray-800 shadow-2xl p-3 sm:p-4"
                        onMouseEnter={() => setIsSpotifyHovered(true)}
                        onMouseLeave={() => setIsSpotifyHovered(false)}
                    >
                        <div 
                            className="flex transition-transform duration-500 ease-out"
                            style={{ transform: `translateX(-${spotifyIndex * 100}%)` }}
                        >
                            {[
                                "2Zt73pxrTMb1qlkEE8Qdjs",
                                "5mvDPiR6GMEFUi3rWJChkM",
                                "5sbrHPJJ3DjViLKu7iHRUl",
                                "1ewxv2MrGu6Gus4DcuVv55",
                                "1XjJk5t2afccJGz3YOKLdg"
                            ].map((playlistId, idx) => (
                                <div key={idx} className="w-full flex-shrink-0 px-1">
                                    <iframe 
                                        style={{ borderRadius: '12px' }} 
                                        src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`} 
                                        width="100%" 
                                        height="352" 
                                        frameBorder="0" 
                                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center space-x-2 mt-4">
                            {[0, 1, 2, 3, 4].map(idx => (
                                <button 
                                    key={idx} 
                                    onClick={() => setSpotifyIndex(idx)}
                                    className={`h-2.5 rounded-full transition-all ${spotifyIndex === idx ? 'w-6 bg-red-600' : 'w-2.5 bg-gray-700 hover:bg-gray-500'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 text-center">
                        <a 
                            href="https://open.spotify.com/user/u8wz5jev5l2tvtn04mbgfzis2?si=hTxKap6tQLCBkwZgwWdkGg&utm_source=copy-link" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-gray-400 hover:text-green-400 transition underline inline-flex items-center gap-1.5"
                        >
                            <i className="fa-brands fa-spotify text-green-500"></i>
                            <span>Spotify − K's VOXプロフィール</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        </a>
                    </div>
                </div>
            </section>

            <section className="bg-black py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-900">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                            <h2 className="text-xl font-extrabold text-white flex items-center justify-center sm:justify-start gap-2">
                                <i className="fa-brands fa-youtube text-red-600 text-2xl"></i>
                                PURE VOXの再生リスト
                            </h2>
                            <p className="text-xs text-gray-400 mt-1">洋楽のアカペラカバー</p>
                        </div>

                        <div className="flex items-center space-x-3">
                            <button 
                                onClick={() => setYtIndex(prev => (prev - 1 + 6) % 6)}
                                className="w-10 h-10 rounded-full bg-gray-900 hover:bg-red-600 text-white flex items-center justify-center transition shadow-lg border border-gray-800"
                            >
                                <i className="fa-solid fa-chevron-left text-sm"></i>
                            </button>
                            <button 
                                onClick={() => setIsYtPaused(!isYtPaused)}
                                className="px-3.5 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 text-xs text-gray-300 transition border border-gray-800 flex items-center gap-1.5"
                            >
                                <i className={`fa-solid ${isYtPaused ? 'fa-play text-green-500' : 'fa-pause text-red-500'}`}></i>
                                <span>{isYtPaused ? '再生' : '一時停止'}</span>
                            </button>
                            <button 
                                onClick={() => setYtIndex(prev => (prev + 1) % 6)}
                                className="w-10 h-10 rounded-full bg-gray-900 hover:bg-red-600 text-white flex items-center justify-center transition shadow-lg border border-gray-800"
                            >
                                <i className="fa-solid fa-chevron-right text-sm"></i>
                            </button>
                        </div>
                    </div>

                    <div 
                        className="relative overflow-hidden rounded-2xl bg-black border border-gray-800 shadow-2xl p-3 sm:p-4"
                        onMouseEnter={() => setIsYtHovered(true)}
                        onMouseLeave={() => setIsYtHovered(false)}
                    >
                        <div 
                            className="flex transition-transform duration-500 ease-out"
                            style={{ transform: `translateX(-${ytIndex * 100}%)` }}
                        >
                            {ytPlaylists.map((pl, idx) => (
                                <div key={idx} className="w-full flex-shrink-0 px-1 space-y-2">
                                    <div className="bg-gray-900/90 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 font-bold flex items-center justify-between">
                                        <span className="flex items-center gap-2 truncate">
                                            <i className="fa-solid fa-list-ul text-red-500"></i>
                                            <span>{pl.title}</span>
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-mono">{idx + 1}/6</span>
                                    </div>
                                    <iframe 
                                        style={{ borderRadius: '12px' }} 
                                        src={`https://www.youtube.com/embed/videoseries?list=${pl.id}`} 
                                        width="100%" 
                                        height="320" 
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                        allowFullScreen 
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-center space-x-2 mt-4">
                            {[0, 1, 2, 3, 4, 5].map(idx => (
                                <button 
                                    key={idx} 
                                    onClick={() => setYtIndex(idx)}
                                    className={`h-2.5 rounded-full transition-all ${ytIndex === idx ? 'w-6 bg-red-600' : 'w-2.5 bg-gray-700 hover:bg-gray-500'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 text-center">
                        <a 
                            href="https://youtube.com/@ksvox" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-gray-400 hover:text-red-400 transition underline inline-flex items-center gap-1.5"
                        >
                            <i className="fa-brands fa-youtube text-red-500"></i>
                            <span>YouTube − K's VOXチャンネル</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-black py-8 border-t border-gray-900 text-center text-xs text-gray-500">
                <div className="max-w-5xl mx-auto px-4 space-y-3">
                    <p className="text-sm font-medium text-gray-300">
                        提供：<a href="https://www.ksvox.net" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline font-bold transition">ボーカル道場 K's VOX</a>
                    </p>
                    <p className="text-gray-600">© 2026 Song Ripple. All rights reserved.</p>
                </div>
            </footer>

            {/* Artist Photo Modal */}
            {modalPhotoUrl && (
                <div 
                    className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6" 
                    onClick={() => setModalPhotoUrl(null)}
                >
                    <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <button 
                            onClick={() => setModalPhotoUrl(null)} 
                            className="absolute -top-11 right-0 text-white text-2xl w-9 h-9 flex items-center justify-center"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                        <img 
                            src={modalPhotoUrl} 
                            alt="アーティスト写真（拡大）" 
                            className="w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl bg-slate-900 border border-gray-700" 
                        />
                    </div>
                </div>
            )}
        </div>
    );
}