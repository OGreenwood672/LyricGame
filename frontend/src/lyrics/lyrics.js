import "./lyrics.scss";
import React, { useState, useEffect, useRef } from "react";

function Lyrics({ socket }) {
    let [lyrics, setLyrics] = useState([]);

    useEffect(() => {

        socket.on("lyric", (data) => {

            // console.log(lyrics);

            let temp = lyrics;
            temp.push({
                text: data.text,
            });
            setLyrics([...temp]);
        });

        socket.on("reset", () => {
            console.log("Resetting");
            lyrics = [];
        });

    }, [socket]);

    const lyricsEndRef = useRef(null);

    const scrollToBottom = () => {
        lyricsEndRef.current.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [lyrics]);


    return (

        <div className="lyrics">
            <div className="lyricScroll">
                {lyrics.slice(0, lyrics.length-1).map((i) => {
                    return (
                        <div className="lyric">
                            <p>{i.text}</p>
                        </div>
                    );
                })}
                {lyrics.slice(lyrics.length-1, lyrics.length).map((i) => {
                    return (
                        <div className="lyric">
                            <h2>{i.text} </h2>
                        </div>
                    )
                })}
                <div ref={lyricsEndRef} />
            </div>
        </div>

    );
}
export default Lyrics;
