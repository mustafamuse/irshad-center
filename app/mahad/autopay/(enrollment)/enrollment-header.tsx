import { motion } from 'framer-motion'

export function EnrollmentHeader() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.8,
          delay: 0.3,
        }}
        className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl"
      >
        Set Up Your Tuition Payment
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.8,
          delay: 0.6,
        }}
        className="mx-auto mt-4 max-w-2xl px-4 text-base text-muted-foreground sm:mt-6 sm:text-lg"
      >
        Welcome to the Mahad's tuition payment portal. Set up your monthly
        payments easily and securely.
      </motion.p>
    </>
  )
}
