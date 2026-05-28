import { motion } from 'framer-motion'

interface NarrativeSceneProps {
  text: string
}

export function NarrativeScene({ text }: NarrativeSceneProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="absolute inset-0 w-full h-full bg-black z-40 flex items-center justify-center p-12"
    >
      {/* Subtle particle effect */}
      <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] pointer-events-none" />
      
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 0.5 }}
        className="text-white text-2xl md:text-4xl font-display tracking-widest text-center max-w-4xl leading-relaxed drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
      >
        {text}
      </motion.p>
    </motion.div>
  )
}
