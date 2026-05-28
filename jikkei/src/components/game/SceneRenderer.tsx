import { motion } from 'framer-motion'

interface SceneRendererProps {
  backgroundUrl?: string
  characterUrl?: string
  children?: React.ReactNode
}

export default function SceneRenderer({ backgroundUrl, characterUrl, children }: SceneRendererProps) {
  return (
    <div className="relative w-full h-full bg-jikkei-black-900 overflow-hidden">
      {/* Background Graphic - True Background Image Layer */}
      {backgroundUrl && (
        <motion.div
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 10, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full z-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: 'rgba(10,10,15,1)'
          }}
        />
      )}


      {/* Decorative Persona-style background elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_center,_transparent_50%,_#000_100%)] z-1" />
      <div className="absolute -left-32 -top-32 w-[600px] h-[600px] bg-jikkei-accent/10 rounded-full blur-[120px] z-1 pointer-events-none" />

      {/* Character Layer - Left Aligned with Fixed Size */}
      {characterUrl && (
        <motion.div 
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="absolute bottom-0 left-[2%] z-10 pointer-events-none"
          style={{ width: '600px', height: '700px' }}
        >
          <img 
            src={characterUrl} 
            alt="Character" 
            className="w-full h-full object-contain object-bottom drop-shadow-[0_0_40px_rgba(233,30,140,0.4)]"
          />
        </motion.div>
      )}

      {/* Bottom shadow fade for dialogue box visibility */}
      <div className="absolute bottom-0 left-0 w-full h-2/5 bg-gradient-to-t from-jikkei-black-900 via-jikkei-black-900/80 to-transparent z-10 pointer-events-none" />

      {/* UI Layer (Dialogue/Choices) */}
      <div className="relative z-20 w-full h-full flex flex-col pointer-events-auto">
        {children}
      </div>
    </div>
  )
}
