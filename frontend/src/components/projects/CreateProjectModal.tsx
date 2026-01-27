import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateProject } from '../../hooks/useProjects';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().or(z.literal('')),
  postingFrequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly', 'custom']),
  videoQuotaPerYear: z.union([
    z.number().int().min(1, 'Quota must be at least 1').max(1000, 'Quota must be 1000 or less'),
    z.nan(),
  ]).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')),
});

type CreateProjectForm = z.infer<typeof createProjectSchema>;

interface CreateProjectModalProps {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      postingFrequency: 'weekly',
    },
  });

  const mutation = useCreateProject({ onSuccess: onClose });

  const onSubmit = (data: CreateProjectForm) => {
    mutation.mutate({
      name: data.name,
      description: data.description || undefined,
      postingFrequency: data.postingFrequency,
      videoQuotaPerYear: data.videoQuotaPerYear && !isNaN(data.videoQuotaPerYear)
        ? data.videoQuotaPerYear
        : undefined,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Project</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. Daily Tech News"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Brief project description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Posting Frequency</label>
            <select
              {...register('postingFrequency')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Video Quota / Year</label>
            <input
              type="number"
              {...register('videoQuotaPerYear', { valueAsNumber: true })}
              placeholder="e.g. 52"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
            />
            {errors.videoQuotaPerYear && (
              <p className="mt-1 text-sm text-red-600">{errors.videoQuotaPerYear.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('startDate')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                {...register('endDate')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {mutation.error && (
            <p className="text-sm text-red-600">
              {(mutation.error as any)?.response?.data?.error || 'Failed to create project'}
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
